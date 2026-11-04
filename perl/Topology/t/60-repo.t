#!perl
use v5.36;                     # strict, warnings, say, signatures (5.36+)
use Test::More;
use File::Temp qw(tempdir);
use File::Path qw(make_path);
use FindBin; use lib "$FindBin::Bin/../lib";
use Topology::Repo;

my $d = tempdir(CLEANUP => 1);
make_path("$d/repos.d", "$d/keys");
sub put { my ($p, $t, $m) = @_; open my $fh, '>', $p or die; print $fh $t; close $fh; chmod $m, $p if defined $m }
put("$d/keys/tok", "s3cret\n", 0644);
put("$d/keys/tok600", "s3cret\n", 0600);
put("$d/repos.d/a.conf", "url = file://$d/upstream.git\n");
put("$d/repos.d/b.conf", "name = b\nurl = https://example.org/b.git\nauth = token-file $d/keys/tok\n");
put("$d/repos.d/c.conf", "name = c\nurl = https://example.org/c.git\nauth = token-file $d/keys/tok600\n");
put("$d/repos.d/d.conf", "name = d\nurl = x\nauth = password hunter2\n");
put("$d/repos.d/e.conf", "name = ../e\nurl = x\n");

put("$d/repos.d/f.conf", "url = x\nbranch = --upload-pack=touch PWNED\n");
put("$d/repos.d/g.conf", "url = https://me:ghp_TOKEN\@github.com/x/y.git\n");
put("$d/repos.d/h.conf", "url = x\nauth = ssh-key /k'; touch PWNED; '\n");
my ($r, $bad) = Topology::Repo::read_dir("$d/repos.d");
is_deeply([ map { $_->name } @$r ], [qw(a b c)], 'three usable files, sorted by name');
is(scalar @$bad, 5, 'five refused, each said');
like(join(' ', @$bad), qr/f\.conf: branch/, 'a branch that is an option is refused');
like(join(' ', @$bad), qr/g\.conf: url holds a password/, 'a token in a url is refused');
unlike(join(' ', @$bad), qr/ghp_TOKEN/, 'and not repeated');
like(join(' ', @$bad), qr/h\.conf: the auth file's path/, 'a key path that could break quoting is refused');
like((grep { /d\.conf/ } @$bad)[0], qr/is not none, ssh-key FILE, token-file FILE or netrc/, 'an unknown auth is refused, and the value is not echoed as a secret');
unlike(join(' ', @$bad), qr/hunter2/, 'a password typed into a conf never reaches the output');
like((grep { /e\.conf/ } @$bad)[0], qr/name '..\/e'/, 'a name that could climb out of the folder is refused');
my %by = map { $_->name => $_ } @$r;
ok(!$by{b}->usable && ($by{b}->problems)[0] =~ /read by others/, 'a token others can read is not used (credentials.strict)');
ok($by{c}->usable, 'a 0600 token is used');
my %env = $by{c}->git_env('/x/askpass');
is($env{GIT_ASKPASS}, '/x/askpass', 'the token goes through GIT_ASKPASS');
unlike(join(' ', %env), qr/s3cret/, 'and its value is in no environment variable');
($r) = Topology::Repo::read_dir("$d/repos.d", strict => 0);
ok((grep { $_->name eq 'b' } @$r)[0]->usable, 'credentials.strict = off lets the operator decide');

SKIP: {
    skip 'git not installed', 4 unless system('git --version >/dev/null 2>&1') == 0;
    # A git hook runs this suite (pre-push runs bin/test.sh) with GIT_DIR and its kin set; pushed from a linked worktree,
    # GIT_DIR is absolute, and the git commands below acted on the repository being pushed (2026-11-03: git init set
    # core.bare in its config, git add replaced its index). So they run with no GIT_ variable but the identity below,
    # and a decoy GIT_DIR, as a hook would hand it on, must come through untouched.
    my %hook = (%ENV, GIT_DIR => "$d/decoy.git", GIT_INDEX_FILE => "$d/decoy.git/index");
    local %ENV = ((map { $_ => $hook{$_} } grep { !/^GIT_/ } keys %hook), GIT_AUTHOR_NAME => 't', GIT_AUTHOR_EMAIL => 't@t', GIT_COMMITTER_NAME => 't', GIT_COMMITTER_EMAIL => 't@t');
    system("git init -q --bare $d/decoy.git") == 0 or die;
    my $decoy = sub { join ',', map { my $f = $_; $f =~ s/^\Q$d\E//; "$f:" . (-s $_ // 0) } sort glob("$d/decoy.git/* $d/decoy.git/refs/heads/*") };
    my $before = $decoy->();
    system("git init -q -b main $d/work && echo hi > $d/work/TOPOLOGY.md && git -C $d/work add . && git -C $d/work commit -qm one && git clone -q --bare $d/work $d/upstream.git") == 0 or die;
    my ($ok, $what) = $by{a}->update("$d/out");
    ok($ok && $what eq 'cloned' && -f "$d/out/a/TOPOLOGY.md", 'cloned into place');
    ($ok, $what) = $by{a}->update("$d/out");
    is($what, 'updated', 'a second run fetches');
    ok(!glob("$d/out/*.tmp.*"), 'no temporary clone is left behind');
    is($decoy->(), $before, 'a repository a hook names in GIT_DIR is left alone');
}
done_testing;

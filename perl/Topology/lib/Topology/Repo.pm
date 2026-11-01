package Topology::Repo 0.01;
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and
# Corwin Brust <corwin@bru.st> and Contributors
#
# Topology::Repo -- one git repository Topology reads, and how to reach it.
# Topology::Repo::read_dir -- the list, from /etc/topology/repos.d/*.conf.
#
# A repos.d file names a secret; it never holds one:
#
#   # /etc/topology/repos.d/c4.conf
#   name   = c4
#   url    = git@github.com:inputloop/c4.git
#   branch = main
#   auth   = ssh-key /etc/topology/keys/c4_ed25519
#
# auth is one of:
#   none                      public, or reached some other way
#   ssh-key FILE              ssh -i FILE -o IdentitiesOnly=yes
#   token-file FILE           an HTTPS token, read by git through GIT_ASKPASS
#   netrc                     the topology user's own ~/.netrc
#
# The token never goes on a command line or into a URL, where ps(1) and
# logs would show it (the same reason medley moved wget passwords into a
# private WGETRC).

use v5.36;                     # strict, warnings, say, signatures (5.36+)
use Feature::Compat::Class;
use File::Spec;
use File::Path qw(make_path);

class Topology::Repo {
    field $name   :param :reader;
    field $url    :param :reader;
    field $branch :param :reader = 'main';
    field $auth   :param :reader = 'none';
    field $from   :param :reader = undef;     # the .conf file it came from
    field $strict :param = 1;                 # credentials.strict in topology.conf
    field @problems;

    ADJUST {
        $name =~ /^[A-Za-z0-9][\w.-]*$/
            or die "$from: name '$name' must be letters, digits, '.', '_' or '-'\n";
        $branch =~ m{^[A-Za-z0-9._][A-Za-z0-9._/-]*$}
            or die "$from: branch '$branch' must be letters, digits, '.', '_', '/' or '-', not starting with '-'\n";
        $url !~ /^-/ or die "$from: url must not start with '-'\n";
        # a secret in the url would be on git's command line and in .git/config
        $url !~ m{^[a-z][a-z0-9+.-]*://[^/\@]*:[^/\@]*\@}i
            or die "$from: url holds a password or token; put it in a token-file instead\n";
        my ($kind, $file) = split ' ', $auth, 2;
        die "$from: the auth file's path must not contain quotes, '\\', '\$' or '`'\n"
            if defined $file && $file =~ /['"\\\$`]/;
        if ($kind eq 'ssh-key' || $kind eq 'token-file') {
            defined $file && length $file or die "$from: auth $kind needs a file\n";
            if (!-r $file) { push @problems, "$file is not readable by this user" }
            elsif ($kind eq 'token-file' && (stat _)[2] & 077) {
                # ssh already refuses a key others can read; git does not
                # check a token file, so we do.  credentials.strict = off
                # lets an operator who knows better carry on.
                push @problems, sprintf '%s can be read by others (mode %04o)', $file, (stat _)[2] & 07777;
            }
        }
        elsif ($kind ne 'none' && $kind ne 'netrc') {
            die "$from: auth '$kind ...' is not none, ssh-key FILE, token-file FILE or netrc\n";
        }
    }

    method problems { @problems }
    method usable   { !$strict || !@problems }
    method auth_kind { (split ' ', $auth)[0] }

    # The environment git runs in for this repository.  No secret value
    # is in it: only the path of the file that holds one.
    method git_env ($askpass) {
        my %env = (GIT_TERMINAL_PROMPT => '0');
        my ($kind, $file) = split ' ', $auth, 2;
        if ($kind eq 'ssh-key') {
            $env{GIT_SSH_COMMAND} = "ssh -i '$file' -o IdentitiesOnly=yes -o BatchMode=yes";
        }
        elsif ($kind eq 'token-file') {
            $env{GIT_ASKPASS} = $askpass;
            $env{TOPOLOGY_TOKEN_FILE} = $file;
        }
        return %env;
    }

    # Bring the checkout under $root up to date: clone into a temporary
    # name beside it and rename into place, or fetch and reset.  Returns
    # (1, 'cloned'|'updated') or (0, reason).
    method update ($root, $askpass = '/usr/libexec/topology/askpass') {
        return (0, join '; ', @problems) unless $self->usable;
        make_path($root);
        my $dst = File::Spec->catdir($root, $name);
        local %ENV = (%ENV, $self->git_env($askpass));
        if (-d "$dst/.git") {
            system('git', '-C', $dst, 'fetch', '--quiet', 'origin', $branch) == 0
                or return (0, "git fetch failed ($?)");
            system('git', '-C', $dst, 'reset', '--quiet', '--hard', "origin/$branch") == 0
                or return (0, "git reset failed ($?)");
            return (1, 'updated');
        }
        my $tmp = "$dst.tmp.$$~";
        system('git', 'clone', '--quiet', '--branch', $branch, '--', $url, $tmp) == 0
            or do { system('rm', '-rf', '--', $tmp); return (0, "git clone failed ($?)") };
        rename $tmp, $dst or return (0, "rename $tmp: $!");
        return (1, 'cloned');
    }
}

# read_dir($dir, strict => 1) -> list of Topology::Repo, sorted by name.
# A file that cannot be read as a repository is reported, not skipped
# silently: the second list holds "file: reason" lines.
sub read_dir ($dir, %opt) {
    my (@repos, @bad);
    opendir my $dh, $dir or return ([], ["$dir: $!"]);
    for my $f (sort grep { /\.conf$/ } readdir $dh) {
        my $p = "$dir/$f";
        my %kv;
        open my $fh, '<', $p or do { push @bad, "$p: $!"; next };
        while (my $l = <$fh>) {
            chomp $l;
            next if $l =~ /^\s*(#|$)/;
            $l =~ /^\s*(\w+)\s*=\s*(.*?)\s*$/ or do { push @bad, "$p:$.: not key = value"; next };
            $kv{lc $1} = $2;
        }
        close $fh;
        my $r = eval {
            Topology::Repo->new(
                name => $kv{name} // ($f =~ s/\.conf$//r), url => $kv{url} // die("$p: no url\n"),
                (defined $kv{branch} ? (branch => $kv{branch}) : ()),
                (defined $kv{auth}   ? (auth   => $kv{auth})   : ()),
                from => $p, strict => $opt{strict} // 1);
        };
        if ($r) { push @repos, $r } else { push @bad, $@ =~ s/\n\z//r }
    }
    closedir $dh;
    return ([ sort { $a->name cmp $b->name } @repos ], \@bad);
}

1;
__END__

=head1 NAME

Topology::Repo - the git repositories Topology reads, and their credentials

=head1 SYNOPSIS

  my ($repos, $bad) = Topology::Repo::read_dir('/etc/topology/repos.d');
  warn "$_\n" for @$bad;
  for my $r (@$repos) {
      my ($ok, $what) = $r->update('/var/lib/topology/repos');
      print $r->name, ": ", ($ok ? $what : "not updated: $what"), "\n";
  }

=cut

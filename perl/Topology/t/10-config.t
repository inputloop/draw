#!perl
use v5.36;                     # strict, warnings, say, signatures (5.36+)
use Test::More;
use File::Temp qw(tempdir);
use FindBin; use lib "$FindBin::Bin/../lib";
use Topology::Config;

my $d = tempdir(CLEANUP => 1);
our $n = 0;
sub conf { my $f = "$d/c" . ++$n; open my $fh, '>', $f or die; print $fh @_; close $fh; Topology::Config->new(file => $f) }

my $c = Topology::Config->new(file => "$d/none");
ok($c->is_on($_), "$_ on by default") for qw(spa web downloads api api.taxonomy repos repos.private);
ok(!$c->is_on('write'), 'write is the one feature off by default');

$c = conf("ceiling = spa\n");
ok($c->is_on('spa'), 'ceiling spa: the app is still installed');
for (qw(web downloads api repos write)) { my ($on, $why) = $c->why($_); ok(!$on && $why =~ /ceiling/, "ceiling spa: $_ off, says why") }

$c = conf("feature.api = off\n");
my ($on, $why) = $c->why('api.taxonomy');
ok(!$on && $why =~ /needs 'api'/, 'a feature needs its rung');
($on, $why) = $c->why('repos');
ok(!$on && $why =~ /needs 'api'/, 'a rung needs every rung below it');
ok($c->is_on('web'), 'rungs below stay on');

$c = conf("feature.write = on   # let go happen\napi.private = never\n");
ok($c->is_on('write'), 'write can be switched on');
is($c->get('api.private'), 'never', 'other keys are kept, comments dropped');

$c = conf("feature.nosuch = on\nthis is not a line\n");
is(scalar($c->notes), 2, 'odd lines are noted, not fatal');
ok(!eval { conf("ceiling = sky\n"); 1 } && $@ =~ /ceiling 'sky'/, 'a bad ceiling is refused in words');
ok(!eval { conf("feature.api = maybe\n"); 1 } && $@ =~ /not on or off/, 'a bad switch is refused in words');
like(join("\n", Topology::Config->new->report), qr/^write\s+off/m, 'report has one line per feature');
done_testing;

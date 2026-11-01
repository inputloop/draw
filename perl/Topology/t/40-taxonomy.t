#!perl
use v5.36;                     # strict, warnings, say, signatures (5.36+)
use Test::More;
use FindBin; use lib "$FindBin::Bin/../lib";
use Topology::Taxonomy;
my $top = "$FindBin::Bin/../../..";
my $t = Topology::Taxonomy->new(file => "$top/taxonomy/pillars.json");
is_deeply([ $t->pillars ], [qw(place part path person)], 'four pillars, in order');
is($t->pillar_for('Firewall'), 'person', 'a firewall answers "who may" (case-blind)');
is($t->pillar_for('diamond'), 'path', 'a decision is a path');
ok(!defined $t->pillar_for('teapot'), 'an unknown kind is a gap, not a guess');
my %p = map { $_ => 1 } $t->pillars;
for my $x ($t->tensions) { ok($p{ $x->{between}[0] } && $p{ $x->{between}[1] }, "tension '$x->{name}' joins two pillars") }
my $n = () = $t->tensions; is($n, 6, 'every pair of four pillars has its tension');
is_deeply([ $t->axis_values('act') ], [qw(describe propose effect)], 'the act axis');
for my $w (@{ $t->data->{words} }) { ok($p{ $w->{pillar} }, "word '$w->{word}' sits in a pillar") }
# Every word the app's settings and wizard show must have a row (or be listed here as owed).
open my $fh, '<', "$top/www/js/topology-core.js" or die;
my $js = do { local $/; <$fh> };
my @shown = qw(container endpoint private notation treatment feature go consent);
is_deeply([ $t->gaps(@shown) ], [], 'no gaps in the words the app shows');
like($js, qr/pillar: '(place|part|path|person)'/, 'the wizard places changes by pillar');
done_testing;

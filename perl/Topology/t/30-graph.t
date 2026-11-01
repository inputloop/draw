#!perl
use v5.36;                     # strict, warnings, say, signatures (5.36+)
use Test::More;
use File::Temp qw(tempdir);
use File::Path qw(make_path);
use FindBin; use lib "$FindBin::Bin/../lib";
use Topology::Graph; use Topology::Taxonomy; use Topology::Build; use Topology::CSV; use Topology::Doc;

my $top = "$FindBin::Bin/../../..";
my $d = tempdir(CLEANUP => 1);
my $g = Topology::Graph->new(root => "$d/graph");

$g->put('host:gw26', kind => 'server')->put('host:gw26', 'odd/name ü', 'yes');
is($g->get('host:gw26', 'kind'), 'server', 'a cell reads back');
$g->put('thing:日本', kind => 'site');
is_deeply([ grep { /日本/ } $g->rows ], ['thing:日本'], 'a row name beyond Latin-1 survives the round trip');
is($g->get('host:gw26', 'odd/name ü'), 'yes', 'a column with / and non-ASCII is encoded, not split');
ok(-f "$d/graph/r/host:gw26/kind" && -f "$d/graph/c/kind/host:gw26", 'written twice: r/ and c/');
is_deeply([ $g->check ], [], 'both sides agree');
{ open my $fh, '>', "$d/graph/c/kind/host:gw26"; print $fh 'router'; }
like(join(' ', $g->check), qr/r\/ and c\/ differ/, 'check finds a cell changed on one side');
unlink "$d/graph/c/kind/host:gw26";
like(join(' ', $g->check), qr/missing from c\//, 'check finds a cell missing on one side');

# A repository checkout with TOPOLOGY.md files, built into the graph.
my $repos = "$d/repos";
make_path("$repos/c4/serve", "$repos/c4/deep/er/still");
sub put { my ($p, $t) = @_; open my $fh, '>:encoding(UTF-8)', $p or die "$p $!"; print $fh $t }
put("$repos/c4/TOPOLOGY.md", "---\nname: c4\nkind: storage\nconnects: gw26\nprivate: hide\n---\n# c4\nThe consent tool.\n## Private\nhost keys live elsewhere\n");
put("$repos/c4/serve/.topology.md", "---\nkind: server\nlayer: operational\ncontains: nginx\nowner: corwin\n---\nserves the desk\n");
put("$repos/c4/deep/er/still/TOPOLOGY.md", "---\nkind: rack\n---\ntoo deep\n");
make_path("$repos/c4/two/down", "$d/outside");
put("$repos/c4/two/down/TOPOLOGY.md", "---\nkind: rack\n---\ntwo folders down\n");
put("$d/outside/token", "ghp_SECRET\n");
symlink "$d/outside/token", "$repos/c4/serve/TOPOLOGY.md" or die;
my $tax = Topology::Taxonomy->new(file => "$top/taxonomy/pillars.json");
my $g2 = Topology::Graph->new(root => "$d/g2");
my @dirs = Topology::Build::from_checkouts(graph => $g2, taxonomy => $tax, root => $repos, repos => ['c4', 'missing']);
is(scalar @dirs, 3, 'three folders read (top, one down, two down); three down is past the depth');
is($g2->get('c4/two/down', 'kind'), 'rack', 'a/b/TOPOLOGY.md is read');
unlike(join(' ', map { $g2->get('c4/serve', $_) // '' } $g2->cols_of('c4/serve')), qr/ghp_SECRET/, 'a TOPOLOGY.md that is a link is not followed');
is($g2->get('repo:c4', 'name'), 'c4', 'the repository row');
is($g2->get('c4/serve', 'container'), 'repo:c4', 'a sub-folder sits in its repository');
is($g2->get('c4/serve', 'pillar'), 'place', 'server is a place');
is($g2->get('c4/serve', 'meta.owner'), 'corwin', 'unknown keys become columns');
is($g2->get('thing:gw26', 'kind'), 'rounded', 'a name only mentioned gets a row');
is($g2->get('repo:c4', 'connects'), 'thing:gw26', 'links point at row ids');
is_deeply([ $g2->check ], [], 'built graph agrees on both sides');

my $data = $g2->as_data;
my ($c4) = grep { $_->{id} eq 'repo:c4' } @{ $data->{nodes} };
ok($c4->{private_kept_back} && !defined $c4->{private}, 'private is kept back by default');
ok(!exists $c4->{declared_private}, 'the server\'s working note is not in the answer');
unlike($g2->get('repo:c4', 'source'), qr{\Q$repos\E}, 'sources are named as the repository names them, not by server path');
my $shown = $g2->as_data(sub { +{ show => 1, by => 'container', seam => undef } });
($c4) = grep { $_->{id} eq 'repo:c4' } @{ $shown->{nodes} };
like($c4->{private} // '', qr/host keys/, 'and shown when the resolver says show');

# The CSV header is TopoForge's own, read from the copy we ship.
open my $tf, '<', "$top/www/topoforge/index.html" or die;
my ($cols) = do { local $/; <$tf> } =~ /CSV_COLS = \[([^\]]+)\]/;
my @tf = $cols =~ /'([a-z_]+)'/g;
is_deeply(\@Topology::CSV::COLS, \@tf, 'our CSV columns are TopoForge 1.7\'s');
my $csv = Topology::CSV::graph_to_csv($data);
like($csv, qr/^c4,storage,.*,gw26,,,place,operational,repo:c4\r$/m, 'a row TopoForge can place, carrying pillar and layer');
done_testing;

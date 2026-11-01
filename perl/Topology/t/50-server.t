#!perl
use v5.36;                     # strict, warnings, say, signatures (5.36+)
use Test::More;
use File::Temp qw(tempdir);
use JSON::PP;
use FindBin; use lib "$FindBin::Bin/../lib";
use Topology::Config; use Topology::Graph; use Topology::Taxonomy; use Topology::Server;
my $top = "$FindBin::Bin/../../..";
my $d = tempdir(CLEANUP => 1);
sub conf { open my $fh, '>', "$d/conf" or die; print $fh @_; close $fh; Topology::Config->new(file => "$d/conf") }
my $g = Topology::Graph->new(root => "$d/g");
$g->put('repo:a', kind => 'storage')->put('repo:a', name => 'a')->put('repo:a', private => 'secret')
  ->put('repo:a', declared_private => "/x/TOPOLOGY.md show\n/x/.topology.md -");
my $tax = Topology::Taxonomy->new(file => "$top/taxonomy/pillars.json");
my $s = Topology::Server->new(graph => $g, taxonomy => $tax, config => conf(""));
my ($st0, undef, $b0) = $s->respond('GET', '/api/v1/graph', 'global=always');
is(JSON::PP->new->decode($b0)->{nodes}[0]{private_by}, 'server', 'by default no private part leaves the server, whatever is asked');
$s = Topology::Server->new(graph => $g, taxonomy => $tax, config => conf("api.private = auto\n"));
my $J = JSON::PP->new;

my ($st, $ty, $b) = $s->respond('GET', '/api/v1/');
is($st, 200, 'index'); ok(!$J->decode($b)->{features}{write}, 'index says write is off');
($st, $ty, $b) = $s->respond('GET', '/api/v1/graph');
is($J->decode($b)->{nodes}[0]{private}, 'secret', 'auto: the component says show, so it shows');
($st, $ty, $b) = $s->respond('GET', '/api/v1/graph', 'c.repo%3Aa=hide');
ok(!defined $J->decode($b)->{nodes}[0]{private}, 'the asker\'s container setting hides it');
is($J->decode($b)->{nodes}[0]{private_by}, 'container', 'and says which setting decided');
($st, $ty, $b) = $s->respond('GET', '/api/v1/graph', 'global=never');
ok(!defined $J->decode($b)->{nodes}[0]{private}, 'global never hides it');
($st) = $s->respond('GET', '/api/v1/graph', 'global=sometimes');
is($st, 400, 'a bad word is a 400, in words');

ok(!eval { conf("api.private = no\n"); 1 } && $@ =~ /not never or auto/, 'a floor word it does not know is refused, not read as auto');
$s = Topology::Server->new(graph => $g, taxonomy => $tax, config => conf("api.private = never\n"));
($st, $ty, $b) = $s->respond('GET', '/api/v1/graph', 'global=always');
is($J->decode($b)->{nodes}[0]{private_by}, 'server', 'the operator\'s floor wins over the asker');

($st, $ty, $b) = $s->respond('POST', '/api/v1/go');
is($st, 403, 'go is refused while write is off'); like($J->decode($b)->{instead}, qr/prompt/, 'and offers the prompt instead');
($st, $ty, $b) = $s->respond('GET', '/api/v1/graph.csv');
like($b, qr/^name,type,/, 'CSV for TopoForge');
($st) = $s->respond('GET', '/api/v1/repos'); is($st, 200, 'repos list');

$s = Topology::Server->new(graph => $g, taxonomy => $tax, config => conf("ceiling = web\n"));
($st) = $s->respond('GET', '/api/v1/graph'); is($st, 404, 'ceiling web: no API');

# The serving half, over a real socket, if the API tier is installed.
SKIP: {
    skip 'IO::Async and Future::AsyncAwait not installed (the api tier)', 2
        unless eval { require IO::Async::Loop; require Future::AsyncAwait; 1 };
    require IO::Socket::INET;
    my $loop = IO::Async::Loop->new;
    $s = Topology::Server->new(graph => $g, taxonomy => $tax, config => conf(""));
    my $l = $s->serve(loop => $loop, port => 0)->get;
    my $port = $l->read_handle->sockport;
    my $pid = fork // die;
    if (!$pid) {
        my $c = IO::Socket::INET->new("127.0.0.1:$port") or exit 1;
        print $c "GET /api/v1/taxonomy HTTP/1.0\r\n\r\n"; local $/; my $r = <$c>;
        exit($r =~ /^HTTP\/1.0 200.*"place"/s ? 0 : 1);
    }
    my $done = $loop->new_future;
    $loop->watch_process($pid => sub { $done->done($_[1]) });
    my $exit = $loop->await($done)->get;
    is($exit, 0, 'a real request over TCP is answered');
    ok($port > 0, "listened on 127.0.0.1:$port");
}
done_testing;

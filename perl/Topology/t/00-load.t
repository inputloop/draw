#!perl
use v5.36;                     # strict, warnings, say, signatures (5.36+)
use Test::More;
use FindBin; use lib "$FindBin::Bin/../lib";
for my $m (qw(Topology Topology::Config Topology::CSV Topology::Doc Topology::Repo
              Topology::Graph Topology::Taxonomy Topology::Build Topology::Server)) {
    use_ok($m);
}
diag("perl $^V; class from " . (Feature::Compat::Class::HAVE_FEATURE_CLASS() ? 'core' : 'Object::Pad'));
done_testing;

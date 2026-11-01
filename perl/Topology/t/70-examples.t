#!perl
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# The examples under examples/ against the shared fixture spec/fixtures/examples.json,
# read by Perl.  Its twin is tests/js/examples.test.mjs; the fixture was written by the
# JS reader, so each test here is also a check that the two readers agree.
use v5.36;                     # strict, warnings, say, signatures (5.36+)
use Test::More;
use JSON::PP ();
use File::Find ();
use FindBin;
use lib "$FindBin::Bin/../lib";
use Topology::Doc;
use Topology::Taxonomy;

my $top = "$FindBin::Bin/../../..";
sub slurp ($p) { open my $fh, '<:raw', $p or die "$p: $!\n"; local $/; scalar <$fh> }
my $fx  = JSON::PP->new->utf8->decode(slurp("$top/spec/fixtures/examples.json"));
my $tax = Topology::Taxonomy->new(file => "$top/taxonomy/pillars.json");

my @disk;
File::Find::find({ no_chdir => 1, wanted => sub {
    push @disk, $File::Find::name =~ s{^\Q$top\E/}{}r if /\/(TOPOLOGY|\.topology)\.md\z/ } }, "$top/examples");
is_deeply([ sort @disk ], [ sort map { $_->{file} } @{ $fx->{files} } ], 'the fixture lists every example on disk');
cmp_ok(scalar @{ $fx->{files} }, '>=', 30, 'the shop is drawn, not sketched');

my (%doc, %names);
for my $f (@{ $fx->{files} }) {
    my $text = do { open my $fh, '<:encoding(UTF-8)', "$top/$f->{file}" or die; local $/; <$fh> };
    my $d = Topology::Doc::File->new(path => $f->{file}, text => $text);
    $doc{ $f->{file} } = $d;
    is_deeply({ map { $_ => $d->meta($_) } $d->meta_keys }, $f->{meta}, "$f->{file}: front matter");
    is_deeply([ $d->public_lines  ], $f->{public},  "$f->{file}: public lines");
    is_deeply([ $d->private_lines ], $f->{private}, "$f->{file}: private lines");
    is($d->declared_private, $f->{declared}, "$f->{file}: declared");
}

for my $f (@{ $fx->{files} }) {
    my $d = $doc{ $f->{file} };
    my ($n, $k) = ($d->meta('name'), $d->meta('kind'));
    ok(length($n // '') && length($k // ''), "$f->{file}: name and kind");
    ok(!$names{$n}++, "$f->{file}: name $n is used once");
    is($d->meta('pillar'), $tax->pillar_for($k), "$f->{file}: pillar agrees with kind $k");
}
for my $f (@{ $fx->{files} }) {
    my $d = $doc{ $f->{file} };
    for my $key (qw(contains connects)) {
        ok($names{$_}, "$f->{file}: $key names $_") for $d->list($key);
    }
}

my %mine = map { $_ => 1 } @{ $fx->{private_projects} };
for my $f (@{ $fx->{files} }) {
    my $d = $doc{ $f->{file} };
    if ($mine{ $d->meta('name') }) {
        is($d->declared_private, 'hide', "$f->{file}: private, says hide");
        ok($d->has_private, "$f->{file}: private, keeps details under ## Private");
        my $r = Topology::Doc::resolve(container => 'auto', global => 'auto', docs => [$d]);
        ok(!$r->{show}, "$f->{file}: resolves to hidden");
    } else {
        ok(!$d->has_private, "$f->{file}: public, no Private part");
        isnt($d->declared_private, 'show', "$f->{file}: public, does not say show");
    }
}

my @pub = map { my $d = $_; ($d->public_lines, map { $d->meta($_) // () } $d->meta_keys) } values %doc;
for my $d (values %doc) {
    for my $l (grep { length(s/^\s+|\s+$//gr) >= 40 } $d->private_lines) {
        my $t = $l =~ s/^\s+|\s+$//gr;
        ok(!(grep { index($_, $t) >= 0 } @pub), "@{[$d->path]}: a private line is not in any public part");
    }
}
my @secretish = (qr/\b\d{1,3}(?:\.\d{1,3}){3}\b/, qr/(?:password|passwd|api[_-]?key|token)\s*[:=]/i, qr/\bghp_\w+/, qr/BEGIN [A-Z ]*PRIVATE KEY/);
for my $l (@pub) { for my $re (@secretish) { unlike($l, $re, "public text is no credential or address") if $l =~ $re || 0 } }
pass('public text was scanned for credentials and addresses');

done_testing;

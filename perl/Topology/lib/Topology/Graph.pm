package Topology::Graph 0.01;
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and
# Corwin Brust <corwin@bru.st> and Contributors
#
# Topology::Graph -- the drawing's facts, kept as keys and values on disk.
#
# Every fact is one cell: a row (a thing, such as "host:gw26"), a column
# (a property, such as "kind"), and a value.  Each cell is written twice:
#
#   r/<row>/<column>    the thing's own view: ls r/host:gw26 lists its properties
#   c/<column>/<row>    the property's view:  ls c/kind lists every thing with a kind
#
# Two writers, two readers: check() reads both and reports any cell they
# disagree on.  A file system is the database; cat, ls, grep and diff are
# its query language, and a person can read it without this module.
#
# Writes are atomic: a temporary file beside the target, then rename
# (the medley idiom, *.tmp.$$~).

use v5.36;                     # strict, warnings, say, signatures (5.36+)
use Feature::Compat::Class;
use File::Path qw(make_path);
use File::Spec;

# Row and column names become file names: keep letters, digits and
# ".:_-@+", and write any other byte as %XX.  "/" is never in a name.
# Non-ASCII is written as its UTF-8 bytes, each %XX.
sub enc ($s) { utf8::encode($s); $s =~ s{([^A-Za-z0-9.:_\-\@+])}{sprintf '%%%02X', ord $1}ger }
sub dec ($s) { $s =~ s{%([0-9A-F]{2})}{chr hex $1}ge; utf8::decode($s); $s }

class Topology::Graph {
    field $root :param :reader;

    ADJUST { make_path("$root/r", "$root/c") }

    method _write ($path, $value) {
        my ($dir) = $path =~ m{^(.*)/[^/]+$};
        make_path($dir);
        my $tmp = "$path.tmp.$$~";
        open my $fh, '>:encoding(UTF-8)', $tmp or die "$tmp: $!\n";
        print {$fh} $value;
        close $fh or die "$tmp: $!\n";
        rename $tmp, $path or die "rename $tmp: $!\n";
    }

    method put ($row, $col, $value) {
        my ($r, $c) = (Topology::Graph::enc($row), Topology::Graph::enc($col));
        $self->_write("$root/r/$r/$c", $value);
        $self->_write("$root/c/$c/$r", $value);
        return $self;
    }

    method get ($row, $col) {
        my $p = "$root/r/" . Topology::Graph::enc($row) . '/' . Topology::Graph::enc($col);
        open my $fh, '<:encoding(UTF-8)', $p or return undef;
        local $/;
        return scalar <$fh>;
    }

    method _ls ($dir) {
        opendir my $dh, $dir or return ();
        my @n = map { Topology::Graph::dec($_) } grep { !/^\./ && !/\.tmp\.\d+~$/ } readdir $dh;
        closedir $dh;
        return sort @n;
    }

    method rows             { $self->_ls("$root/r") }
    method cols             { $self->_ls("$root/c") }
    method cols_of ($row)   { $self->_ls("$root/r/" . Topology::Graph::enc($row)) }
    method rows_with ($col) { $self->_ls("$root/c/" . Topology::Graph::enc($col)) }
    method row ($row)       { +{ map { $_ => $self->get($row, $_) } $self->cols_of($row) } }

    # Every cell read from both sides.  Returns a list of "row col: why".
    method check {
        my @bad;
        for my $r ($self->rows) {
            for my $c ($self->cols_of($r)) {
                my $p = "$root/c/" . Topology::Graph::enc($c) . '/' . Topology::Graph::enc($r);
                my $v = -e $p ? do { open my $fh, '<:encoding(UTF-8)', $p; local $/; <$fh> } : undef;
                push @bad, "$r $c: missing from c/" unless defined $v;
                push @bad, "$r $c: r/ and c/ differ" if defined $v && $v ne $self->get($r, $c);
            }
        }
        for my $c ($self->cols) {
            for my $r ($self->rows_with($c)) {
                push @bad, "$r $c: missing from r/" unless defined $self->get($r, $c);
            }
        }
        return @bad;
    }

    # The graph as the API sends it: nodes with their cells, and the
    # links named by "connects" and "contains".  $show is a code ref
    # ($row) -> { show, by, seam } deciding private parts per row.
    method as_data ($show = sub { +{ show => 0, by => 'default', seam => undef } }) {
        my (@nodes, @links);
        for my $r ($self->rows) {
            my $cells = $self->row($r);
            next unless defined $cells->{kind};
            # private goes out only as decided below; declared_private is the
            # server's working note for that decision, not part of the answer
            my %n = (id => $r, map { $_ => $cells->{$_} } grep { $_ ne 'private' && $_ ne 'declared_private' } keys %$cells);
            if (defined $cells->{private}) {
                my $d = $show->($r);
                $n{private} = $d->{show} ? $cells->{private} : undef;
                $n{private_kept_back} = $d->{show} ? JSON::PP::false() : JSON::PP::true();
                $n{private_by} = $d->{by};
                $n{private_seam} = $d->{seam} if defined $d->{seam};
            }
            for my $rel (qw(connects contains)) {
                next unless defined $cells->{$rel};
                push @links, map { +{ from => $r, to => $_, rel => $rel } } grep { length } split /\n/, $cells->{$rel};
            }
            push @nodes, \%n;
        }
        return { nodes => \@nodes, links => \@links };
    }
}

require JSON::PP;
1;
__END__

=head1 NAME

Topology::Graph - facts as rows and columns of small files, written twice

=head1 SYNOPSIS

  my $g = Topology::Graph->new(root => '/var/lib/topology/graph');
  $g->put('host:gw26', kind => 'server');
  print $g->get('host:gw26', 'kind'), "\n";      # server
  print "$_\n" for $g->rows_with('kind');         # host:gw26
  die join("\n", $g->check), "\n" if $g->check;

=head1 ON DISK

  r/host:gw26/kind      server
  c/kind/host:gw26      server

=cut

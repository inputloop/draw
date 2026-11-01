package Topology::Config;
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and
# Corwin Brust <corwin@bru.st> and Contributors
#
# Topology::Config -- read /etc/topology/topology.conf and answer
# "is this feature on?".
#
# Written in classic Perl on purpose (package, bless, @ISA-free hash
# object): this is the file an operator opens at 2am, and it should
# read the way Perl has read since 5.004.  The data objects of the app
# (Topology::Doc, Topology::Graph, Topology::Repo) use the new class
# syntax; doc/CLASSIC-BRIDGE.pod shows the two side by side.

use strict;
use warnings;
use Carp qw(croak);

our $VERSION = '0.01';

# The ladder.  Each rung needs every rung below it.  A feature that is
# switched on above the ceiling is off, and "topology config" says so.
our @LADDER = qw(spa web api repos write);

# Features, the rung each sits on, and whether it is on when nothing
# says otherwise.  New features ship on (that is the house default) and
# every one of them can be switched off here or capped by the ceiling.
our %FEATURE = (
    'spa'           => { rung => 'spa',   default => 1, says => 'install the browser app under /usr/share/topology/www' },
    'web'           => { rung => 'web',   default => 1, says => 'serve the browser app and the downloads over HTTP (an nginx snippet)' },
    'downloads'     => { rung => 'web',   default => 1, says => 'list the source and Debian packages for browsing and download' },
    'api'           => { rung => 'api',   default => 1, says => 'run topology-api, the graph API, read-only' },
    'api.taxonomy'  => { rung => 'api',   default => 1, says => 'serve the four-pillar taxonomy at /api/v1/taxonomy' },
    'repos'         => { rung => 'repos', default => 1, says => 'fetch the git repositories named in repos.d' },
    'repos.private' => { rung => 'repos', default => 1, says => 'send private parts of TOPOLOGY.md when the asker\'s settings show them' },
    'write'         => { rung => 'write', default => 0, says => 'accept "go": let tools effect a proposed change' },
);

sub new {
    my ($class, %arg) = @_;
    my $self = bless {
        file    => $arg{file},
        ceiling => 'write',
        set     => {},            # feature => 0|1, as written in the file
        other   => {},            # any other key = value, kept
        notes   => [],            # what was odd in the file, in words
    }, $class;
    $self->_read if defined $self->{file} && -e $self->{file};
    return $self;
}

sub _read {
    my $self = shift;
    my $file = $self->{file};
    open my $fh, '<', $file or croak "$file: $!";
    while (my $line = <$fh>) {
        chomp $line;
        $line =~ s/\s+#.*$//;
        next if $line =~ /^\s*(#|$)/;
        unless ($line =~ /^\s*([\w.]+)\s*=\s*(.*?)\s*$/) {
            push @{ $self->{notes} }, "$file:$.: not key = value, skipped";
            next;
        }
        my ($k, $v) = (lc $1, $2);
        if ($k eq 'ceiling') {
            if (grep { $_ eq lc $v } @LADDER) { $self->{ceiling} = lc $v }
            else { croak "$file:$.: ceiling '$v' is not one of @LADDER" }
        }
        elsif ($k =~ /^feature\.(.+)$/) {
            my $f = $1;
            exists $FEATURE{$f} or push @{ $self->{notes} }, "$file:$.: no feature named '$f'";
            $self->{set}{$f} = _bool($v, "$file:$.");
        }
        elsif ($k eq 'api.private') {
            # the operator's floor: a word it does not know is an error, never a default
            $v = lc $v;
            $v eq 'never' || $v eq 'auto' or croak "$file:$.: api.private '$v' is not never or auto";
            $self->{other}{$k} = $v;
        }
        else {
            $self->{other}{$k} = $v;
        }
    }
    close $fh;
}

sub _bool {
    my ($v, $where) = @_;
    return 1 if $v =~ /^(on|yes|true|1)$/i;
    return 0 if $v =~ /^(off|no|false|0)$/i;
    croak "$where: '$v' is not on or off";
}

sub rung_index {
    my ($rung) = @_;
    for my $i (0 .. $#LADDER) { return $i if $LADDER[$i] eq $rung }
    croak "no rung '$rung'";
}

# is_on('repos') -> 1 or 0.  why('repos') says which line decided.
sub is_on {
    my ($self, $f) = @_;
    return ($self->why($f))[0];
}

sub why {
    my ($self, $f) = @_;
    my $def = $FEATURE{$f} or croak "no feature named '$f'";
    return (0, "above the ceiling ($self->{ceiling})")
        if rung_index($def->{rung}) > rung_index($self->{ceiling});
    # a feature needs the rung it stands on to be on
    if ($f ne $def->{rung} && exists $FEATURE{ $def->{rung} }) {
        my ($on, $because) = $self->why($def->{rung});
        return (0, "needs '$def->{rung}', which is off: $because") unless $on;
    }
    # and every rung below it
    for my $i (0 .. rung_index($def->{rung}) - 1) {
        my $r = $LADDER[$i];
        next unless exists $self->{set}{$r} && !$self->{set}{$r};
        return (0, "needs '$r', which is switched off");
    }
    return ($self->{set}{$f}, "feature.$f = " . ($self->{set}{$f} ? 'on' : 'off'))
        if exists $self->{set}{$f};
    return ($def->{default}, 'default (' . ($def->{default} ? 'on' : 'off') . ')');
}

# The names of every feature, and whether a name is one of them.
sub features { sort keys %FEATURE }
sub known    { exists $FEATURE{ $_[-1] } }

sub ceiling { $_[0]{ceiling} }
sub notes   { @{ $_[0]{notes} } }
sub get     { $_[0]{other}{ lc $_[1] } }

# The operator's floor for private parts.  Default never: "show private"
# is each asker's own preference, and anyone who can reach the API can
# ask; an operator who serves only trusted askers sets auto.
sub private_floor { $_[0]{other}{'api.private'} // 'never' }

# One line per feature, for "topology config".
sub report {
    my $self = shift;
    my @out = ("ceiling = $self->{ceiling}");
    for my $f (sort { rung_index($FEATURE{$a}{rung}) <=> rung_index($FEATURE{$b}{rung}) or $a cmp $b } keys %FEATURE) {
        my ($on, $why) = $self->why($f);
        push @out, sprintf '%-14s %-3s  %s  (%s)', $f, $on ? 'on' : 'off', $FEATURE{$f}{says}, $why;
    }
    push @out, map { "note: $_" } $self->notes;
    return @out;
}

1;
__END__

=head1 NAME

Topology::Config - the feature ladder of /etc/topology/topology.conf

=head1 SYNOPSIS

  my $c = Topology::Config->new(file => '/etc/topology/topology.conf');
  print "$_\n" for $c->report;
  exit 0 unless $c->is_on('api');

=head1 DESCRIPTION

Every feature can be switched off.  C<ceiling = spa> switches off all of
them but the installed browser app, which is then just files under
F</usr/share/topology/www>, findable and served by nothing.

=cut

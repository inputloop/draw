package Topology::Doc 0.01;
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and
# Corwin Brust <corwin@bru.st> and Contributors
#
# Topology::Doc -- read a container's TOPOLOGY.md (and .topology.md),
# and decide whether its private part is shown.
#
# This file uses perl's new class syntax (perl 5.38 and later; the
# :reader attribute needs 5.40, :writer 5.42).  If you learned Perl
# objects as "a package, a hash and bless", read doc/CLASSIC-BRIDGE.pod
# first: every construct below has its classic twin there, line for line.

use v5.36;                     # strict, warnings, say, signatures (5.36+)
use Feature::Compat::Class;    # core 'class' on 5.42+, Object::Pad before

# --- Classic note -------------------------------------------------------
# 'class Topology::Doc::File { ... }' is roughly
#     package Topology::Doc::File;
#     sub new { my ($class, %a) = @_; my $self = bless {...}, $class; ... }
# 'field $path :param :reader;' is roughly
#     $self->{path} = delete $a{path} // croak "path required";
#     sub path { $_[0]{path} }
# but the field is a lexical variable inside each method, not a hash key,
# so a typo ($pth) is a compile error rather than a silent undef.
# ------------------------------------------------------------------------

class Topology::Doc::File {
    field $path   :param :reader;      # where it was read from
    field $text   :param;              # the whole file, as read
    field %meta   ;                    # front matter, key => value
    field @public ;                    # body lines outside "## Private"
    field @private;                    # body lines under "## Private"

    # ADJUST runs after the constructor has set the :param fields;
    # classic readers can think of it as the tail of sub new.
    ADJUST {
        my @lines = split /\r?\n/, $text, -1;
        my $i = 0;
        if (@lines && $lines[0] eq '---') {
            # front matter only if it closes; otherwise the whole file is body
            my ($close) = grep { $lines[$_] eq '---' } 1 .. $#lines;
            if (defined $close) {
                for my $j (1 .. $close - 1) {
                    next if $lines[$j] =~ /^\s*(#|$)/;
                    $meta{lc $1} = $2
                        if $lines[$j] =~ /^([[:alpha:]][\w.-]*)\s*:\s*(.*?)\s*(?:#.*)?$/;
                }
                $i = $close + 1;
            }
        }
        my ($in_private, $fence) = (0, undef);
        for (; $i < @lines; $i++) {
            my $l = $lines[$i];
            # a fenced code block (``` or ~~~) holds no headings
            if (defined $fence) { undef $fence if $l =~ /^ {0,3}\Q$fence\E\s*$/ }
            elsif ($l =~ /^ {0,3}(`{3,}|~{3,})/) { $fence = $1 }
            elsif ($l =~ /^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/) {
                my ($lvl, $h) = (length $1, lc $2);
                # "Private" opens the private part; a Private heading inside it
                # does not move where it ends; any other heading at the same
                # or a higher level closes it.
                if ($h eq 'private') { $in_private = $lvl unless $in_private; next }
                $in_private = 0 if $in_private && $lvl <= $in_private;
            }
            push @{ $in_private ? \@private : \@public }, $l;
        }
    }

    method meta ($key)      { $meta{lc $key} }
    method meta_keys        { sort keys %meta }
    method public_lines     { @public }
    method private_lines    { @private }
    method has_private      { scalar grep { /\S/ } @private }

    # The component's own say on privacy: 'show', 'hide', or undef.
    method declared_private {
        my $v = lc($meta{private} // '');
        return $v eq 'show' || $v eq 'hide' ? $v : undef;
    }

    # A list-valued key: "a, b; c" -> (a, b, c)
    method list ($key) {
        my $v = $meta{lc $key} // return ();
        return grep { length } map { s/^\s+|\s+$//gr } split /[,;]/, $v;
    }
}

# Resolution follows spec/TOPOLOGY-md.md, section "Show private".
# Written as plain subs (classic style) on purpose: it is a rule, not
# an object, and operators should be able to read it at a glance.

my %GLOBAL = (always => 'show', never => 'hide', auto => 'auto');
my %LOCAL  = (show => 'show', hide => 'hide', auto => 'auto');

# resolve(container => $c, global => $g, docs => [$file, ...])
# returns a hash ref: { show => 0|1, by => WHO, seam => TEXT|undef }
sub resolve (%a) {
    my $c = lc($a{container} // '');
    my $g = lc($a{global}    // 'auto');
    die "show-private: container setting '$c' is not show, hide or auto\n"
        if length $c && !exists $LOCAL{$c};
    die "show-private: global setting '$g' is not always, never or auto\n"
        unless exists $GLOBAL{$g};

    return { show => $c eq 'show' ? 1 : 0, by => 'container', seam => undef }
        if $c eq 'show' || $c eq 'hide';
    return { show => $GLOBAL{$g} eq 'show' ? 1 : 0, by => 'global', seam => undef }
        if !length $c && $g ne 'auto';

    # auto: ask the component's own TOPOLOGY.md (and .topology.md).
    # docs are Topology::Doc::File objects, or [path, 'show'|'hide'|undef]
    # pairs as the graph keeps them (column declared_private).
    my @said = grep { defined $_->[1] }
               map { ref $_ eq 'ARRAY' ? $_ : [ $_->path, $_->declared_private ] }
               @{ $a{docs} // [] };
    return { show => 0, by => 'default', seam => undef } unless @said;
    my %seen = map { $_->[1] => 1 } @said;
    if (keys %seen > 1) {
        # Two readers disagree: the more private reading wins, and we say so.
        my $seam = join ' / ', map { "$_->[0] says $_->[1]" } @said;
        return { show => 0, by => 'component', seam => $seam };
    }
    return { show => $said[0][1] eq 'show' ? 1 : 0, by => 'component', seam => undef };
}

# read_dir($dir) -> list of Topology::Doc::File, TOPOLOGY.md first.
sub read_dir ($dir) {
    my @out;
    for my $name ('TOPOLOGY.md', '.topology.md') {
        my $p = "$dir/$name";
        # a link is never followed: it could point at a key or a token
        next if -l $p || !-f _;
        open my $fh, '<:encoding(UTF-8)', $p or die "$p: $!\n";
        local $/;
        my $text = <$fh>;
        close $fh;
        push @out, Topology::Doc::File->new(path => $p, text => $text);
    }
    return @out;
}

1;
__END__

=head1 NAME

Topology::Doc - read TOPOLOGY.md files and decide what of them is shown

=head1 SYNOPSIS

  use Topology::Doc;
  my @docs = Topology::Doc::read_dir('/srv/repos/c4');
  my $r = Topology::Doc::resolve(container => 'auto', global => 'auto', docs => \@docs);
  print $r->{show} ? "showing private\n" : "private kept back ($r->{by})\n";

=head1 DESCRIPTION

A container (a repository, a host, a folder) may describe itself in a
F<TOPOLOGY.md> or F<.topology.md> at its top.  See F<spec/TOPOLOGY-md.md>
for the format and the rule for showing the private part; the same rule
is written a second time in JavaScript (F<www/js/topology-core.js>), and
both are run against the same fixtures.

=head1 SEE ALSO

L<perlclass>, L<Feature::Compat::Class>, L<Object::Pad>, F<doc/CLASSIC-BRIDGE.pod>.

=cut

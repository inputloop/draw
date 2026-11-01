package Topology::Server 0.01;
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Copyright 2026 Bryant Frankford <nathanielfrankford@gmail.com> and
# Corwin Brust <corwin@bru.st> and Contributors
#
# Topology::Server -- the graph API (topology-api), read-only unless the
# 'write' feature is on.
#
# Two halves.  The answer to a request is a plain method, respond(), that
# takes (method, path, query) and returns (status, type, body): the tests
# call it with no network at all.  The serving half is async, written
# with Future::AsyncAwait on IO::Async (both by Paul Evans, who also
# wrote perl's core class feature); it reads one request per connection
# and expects nginx in front for TLS, keep-alive and the rest of HTTP.
#
# Classic note on 'async method': an async method returns a Future at
# once; 'await $f' inside it pauses this method (not the program) until
# $f is ready.  In classic Perl you would write the same thing as a
# chain: $f->then(sub { ... })->then(sub { ... }).

use v5.36;                     # strict, warnings, say, signatures (5.36+)
use Feature::Compat::Class;
use JSON::PP ();
use Topology::Doc;
use Topology::Config ();

my $JSON = JSON::PP->new->canonical->utf8;

class Topology::Server {
    field $graph    :param;         # Topology::Graph
    field $taxonomy :param;         # Topology::Taxonomy
    field $config   :param;         # Topology::Config
    field $repos    :param = [];    # [Topology::Repo]
    field $version  :param = "$Topology::Server::VERSION";

    method _q ($query) {
        my %q;
        for (split /&/, $query // '') {
            my ($k, $v) = map { s/\+/ /gr =~ s/%([0-9A-Fa-f]{2})/chr hex $1/ger } split /=/, $_, 2;
            $q{$k} = $v // '';
        }
        return \%q;
    }

    # How the asker's settings (sent as query words) and the operator's
    # floor decide each row's private part.
    method _shower ($q) {
        my $floor = $config->private_floor;                          # never | auto
        my $can   = $config->is_on('repos.private') && $floor ne 'never';
        return sub ($row) {
            return { show => 0, by => 'server', seam => undef } unless $can;
            my @said = map { [ split / /, $_, 2 ] } grep { length }
                       split /\n/, ($graph->get($row, 'declared_private') // '');
            $_->[1] = undef for grep { ($_->[1] // '-') eq '-' } @said;
            return Topology::Doc::resolve(
                container => $q->{"c.$row"} // '',
                global    => $q->{global}   // 'auto',
                docs      => \@said);
        };
    }

    method respond ($method, $path, $query = '') {
        my $q = $self->_q($query);
        return (405, 'text/plain', "only GET and POST\n") unless $method eq 'GET' || $method eq 'POST';
        return (404, 'text/plain', "the API is switched off on this server\n") unless $config->is_on('api');

        if ($path eq '/api/v1' || $path eq '/api/v1/') {
            my %f = map { $_ => ($config->is_on($_) ? JSON::PP::true() : JSON::PP::false()) }
                    Topology::Config::features();
            return (200, 'application/json', $JSON->encode({
                topology => $version, ceiling => $config->ceiling, features => \%f,
                private_floor => $config->private_floor,
                routes => [qw(/api/v1/graph /api/v1/graph.csv /api/v1/nodes/ID /api/v1/repos /api/v1/taxonomy /api/v1/go)] }));
        }
        if ($path eq '/api/v1/graph') {
            my $d = eval { $graph->as_data($self->_shower($q)) };
            return (400, 'text/plain', $@) unless $d;
            return (200, 'application/json', $JSON->encode($d));
        }
        if ($path eq '/api/v1/graph.csv') {
            return (200, 'text/csv; charset=utf-8', $self->csv);
        }
        if ($path =~ m{^/api/v1/nodes/(.+)$}) {
            my $id = $1 =~ s/%([0-9A-Fa-f]{2})/chr hex $1/ger;
            my $d = eval { $graph->as_data($self->_shower($q)) } or return (400, 'text/plain', $@);
            my ($n) = grep { $_->{id} eq $id } @{ $d->{nodes} };
            return $n ? (200, 'application/json', $JSON->encode($n)) : (404, 'text/plain', "no node $id\n");
        }
        if ($path eq '/api/v1/repos') {
            return (404, 'text/plain', "repos is switched off\n") unless $config->is_on('repos');
            # names and the kind of credential only: never a file path or a secret
            return (200, 'application/json', $JSON->encode([ map { +{
                name => $_->name, branch => $_->branch, auth => $_->auth_kind,
                usable => $_->usable ? JSON::PP::true() : JSON::PP::false() } } @$repos ]));
        }
        if ($path eq '/api/v1/taxonomy') {
            return (404, 'text/plain', "taxonomy is switched off\n") unless $config->is_on('api.taxonomy');
            return (200, 'application/json', $JSON->encode($taxonomy->data));
        }
        if ($path eq '/api/v1/go') {
            return (405, 'text/plain', "go is a POST\n") unless $method eq 'POST';
            # Bridget's third act.  Off by default; when off, say what would
            # have happened and hand back the prompt instead.
            my ($on, $why) = $config->why('write');
            return (403, 'application/json', $JSON->encode({
                done => JSON::PP::false(), why => "go is off on this server: $why",
                instead => 'The change was not made. Copy the proposal as a prompt and give it to tools you trust.' }))
                unless $on;
            return (501, 'application/json', $JSON->encode({ done => JSON::PP::false(),
                why => 'write is on, but no tool that effects changes is installed on this server yet' }));
        }
        return (404, 'text/plain', "no such route: $path\n");
    }

    method csv {
        require Topology::CSV;
        return Topology::CSV::graph_to_csv($graph->as_data);
    }

    # Serve until the loop stops.  Needs IO::Async and Future::AsyncAwait
    # (the 'api' tier of vendor/VENDOR.org).
    method serve (%a) {
        require IO::Async::Loop;
        require IO::Async::Listener;
        my $loop = $a{loop} // IO::Async::Loop->new;
        my $listener = IO::Async::Listener->new(on_stream => sub ($l, $stream) {
            $stream->configure(on_read => sub ($s, $buf, $eof) {
                return 0 unless $$buf =~ /\r?\n\r?\n/;    # wait for the whole head
                my ($m, $target) = $$buf =~ m{^(\w+)\s+(\S+)};
                $$buf = '';
                my ($p, $qs) = split /\?/, ($target // '/'), 2;
                my ($st, $type, $body) = eval { $self->respond($m // 'GET', $p, $qs) };
                ($st, $type, $body) = (500, 'text/plain', "error: $@") unless defined $st;
                utf8::encode($body) if utf8::is_utf8($body);
                $s->write(sprintf("HTTP/1.0 %d %s\r\nContent-Type: %s\r\nContent-Length: %d\r\n"
                    . "Access-Control-Allow-Origin: %s\r\nConnection: close\r\n\r\n",
                    $st, ($st < 400 ? 'OK' : 'Error'), $type, length $body,
                    $config->get('api.cors') // '*') . $body);
                $s->close_when_empty;
                return 0;
            });
            $l->loop->add($stream);
        });
        $loop->add($listener);
        return $listener->listen(
            addr => { family => 'inet', socktype => 'stream',
                      ip => $a{host} // '127.0.0.1', port => $a{port} // 8740 })
            ->then(sub ($l, @) { $a{on_listen}->($l) if $a{on_listen}; Future->done($l) });
    }
}

1;

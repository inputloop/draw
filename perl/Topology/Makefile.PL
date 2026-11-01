# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
# Made the way h2xs -X -n Topology makes a Makefile.PL, then filled in.
use 5.036;
use strict;
use warnings;
use ExtUtils::MakeMaker;

WriteMakefile(
    NAME             => 'Topology',
    VERSION_FROM     => 'lib/Topology.pm',
    ABSTRACT_FROM    => 'lib/Topology.pm',
    AUTHOR           => ['Bryant Frankford <nathanielfrankford@gmail.com>',
                         'Corwin Brust <corwin@bru.st>'],
    LICENSE          => 'gpl_3',
    MIN_PERL_VERSION => '5.036',
    EXE_FILES        => ['script/topology', 'script/topology-askpass'],
    PREREQ_PM        => {
        'Feature::Compat::Class' => '0.08',   # core class on 5.42+, Object::Pad before
        'Future'                 => '0.50',
        'JSON::PP'               => 0,        # core
    },
    # The API tier: only 'topology serve' needs these.
    META_MERGE       => {
        'meta-spec' => { version => 2 },
        prereqs => { runtime => { recommends => {
            'IO::Async' => '0.80', 'Future::AsyncAwait' => '0.66' } } },
        resources => { repository => { type => 'git',
            url => 'https://github.com/inputloop/topology.git' } },
    },
    TEST_REQUIRES    => { 'Test::More' => '0.98' },
    test             => { TESTS => 't/*.t' },
);

\version "2.26"
\language "english"

% Auto-height page: the rendered SVG hugs the music instead of filling a full page
\paper {
  page-breaking = #ly:one-page-breaking
}

\header {
  title = "Practice Arpeggios"
  tagline = ##f
}
chordNames = \chordmode {
  g1:m | g1:m | c1:m | c1:m |
  f1   | f1   | bf1  | bf1  |
}



simple_Arpeggios = \relative c'' {
 | g 4  bf  d  g    bf   g  d  bf
 | c 4  ef  g  c-1  ef   c  g  ef
 \break
 | f,4  a   c  f     a    f   c   a
 | bf4  d   f  bf-1  d    bf  f   d
}

\score {
  <<
    \new ChordNames { \chordNames }
    \new Staff { \simple_Arpeggios }
  >>
  \layout { indent = 0
  }
  \midi { }
}

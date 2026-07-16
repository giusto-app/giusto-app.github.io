\version "2.26.0"
\language "english"

% Auto-height page: the rendered SVG hugs the music instead of filling a
% full letter page (Giusto scales it to the panel width).
\paper {
  page-breaking = #ly:one-page-breaking
}
chordNames = \chordmode {
  g1:m | g1:m | c1:m | c1:m |
  f1   | f1   | bf1  | bf1  |
}

\header {
  title = "Practice Arpeggios"
  tagline = ##f
}

simple_Arpeggios = \relative c'' {
 | g 4  bf  d  g  bf   g  d  bf 
 | c 4  ef  g  c  ef   c  g  ef 
 \break
 | f,4  a   c  f  a    f  c  a
 | bf4  d   f  bf  d    bf  f  d
}

\score {
  <<
    \new ChordNames { \chordNames }
    \new Staff { \simple_Arpeggios }
  >>
  \layout { }
  \midi { }
}

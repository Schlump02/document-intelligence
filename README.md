# Skripte zur Dokumentenanalyse

## Wörter zählen

### Ziel

Mithilfe des Skriptes in `src/pdf-reader/wordCounter.mjs` können die Wörter in einem PDF gezählt werden, welches auf Basis der <a href="https://github.com/Schlump02/barm-latex-vorlagen">BA Rhein-Main LaTeX Vorlage</a> erstellt wurde. Dabei sollen die Vorgaben der BA zur Wörterzählung möglichst genau eingehalten werden. In der Praxis konnte dieses Skript eine Übereinstimmung von 99,97% mit einer von Word durchgeführten Zählung erreichen. Die gezählten Wörter werden unterteilt nach Unterkapitel und in die Kategorien Fließtext, Fußnoten, wörtliche Zitate und Bildunterschriften.

### Nutzung

Wenn VS Code für die Erstellung des Dokuments verwendet wird, kann dieses Skript automatisch bei jeder Erstellung ausgeführt werden, was auf <a href="https://github.com/Schlump02/barm-latex-vorlagen/wiki/W%C3%B6rter-automatisch-z%C3%A4hlen-in-VS-Code">dieser</a> Wiki-Seite beschrieben wird.

Das Skript kann ebenfalls auf <a href="https://barm.jona.codes">dieser</a> Webseite getestet werden.

In `src/pdf-reader` befindet sich das Skript in der `wordCounter.mjs`-Datei. Zudem gibt es die Dateien `wordCounterToConsole.mjs` und `wordCounterToFile.mjs`, die mit `node --experimental-modules wordCounterToFile.mjs` ausgeführt werden können, um das Ergebnis der Zählung in der Konsole auszugeben bzw. in eine Datei zu schreiben. Dabei werden auch einige Debug-Informationen ausgegeben.

### Benchmark-Dateien

Die Benchmark PDF-Datei enthält:
- **327** Wörter inkl. wörtliche Zitate, Fußnoten und Bild- und Tabellenunterschriften
- **141** Wörter exkl. wörtliche Zitate, Fußnoten und Bild- und Tabellenunterschriften

Diese resultieren aus:

**141** Wörtern exkl. wörtliche Zitate / Fußnoten, davon:
- 32 in Kapitel 1 (ohne Unterkapitel)
- 58 in Kapitel 1.1
- 0 in Kapitel 1.2 (ohne Unterkapitel)
- 15 in Kapitel 1.2.1
- 20 in Kapitel 1.2.2
- 10 in Kapitel 1.2.2.1
- 0 in Kapitel 1.3
  - \+322 in Kapitel 1.4, falls einkommentiert
- 0 in Kapitel 2
- 6 in Kapitel 2.1
- 0 in Kapitel 3

**83** Wörtern aus wörtlichen Zitaten, davon:
- 9 in Kapitel 1 (ohne Unterkapitel)
- 54 in Kapitel 1.3
- 20 in Kapitel 2

**94** Wörtern aus Fußnoten, davon:
- 17 in Kapitel 1 (ohne Unterkapitel)
- 55 in Kapitel 1.2.1
- 16 in Kapitel 1.2.2
- 3 in Kapitel 1.3
- 3 in Kapitel 2

**9** Wörtern aus Bild- und Tabellenunterschriften, davon:
- 9 in Kapitel 1 (ohne Unterkapitel)

## Autoren

Erstellt durch die Mitwirkenden (Contributors) an diesem Repository. Die Benchmark-Dateien basieren auf der Vorlage zur Bachelorarbeit aus dem Github-Repository <a href="https://github.com/Schlump02/barm-latex-vorlagen">barm-latex-vorlagen</a>.

## Lizenz / License

Creative Commons CC BY 4.0

<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a>

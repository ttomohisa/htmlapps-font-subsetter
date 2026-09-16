# Font Subsetter test data

Browser Kitty Font Subsetter v1.0.0 の動作確認用データです。フォントはこのテストのために生成した単純な矩形グリフで、第三者フォントの字形データは含みません。

## fonts

- `BKTest-Regular.ttf`: weight 400。ASCIIの一部、日本語、髙/﨑/𠮷を収録。
- `BKTest-Bold.ttf`: weight 700。同じ文字セット。
- `BKTest-ASCII.ttf`: U+0020〜U+007Eのみ。日本語不足表示の確認用。
- `BKTest-Restricted.ttf`: OS/2 fsType = 0x0002。Restricted License確認用。
- `BKTest-NoSubsetting.ttf`: fsType = 0x0100。No Subsettingブロック確認用。
- `BKTest-BitmapOnly.ttf`: fsType = 0x0200。Bitmap embedding onlyブロック確認用。
- `BKTest-Regular.woff` / `.woff2`: 読み込み・基本情報確認用。v1.0.0では再サブセット対象外。

## sources

UTF-8 TXT/Markdown/HTML/CSS/JS/JSON、BOM付きUTF-16、壊れたXMLを含みます。`sample.html` の script は実行されないことを確認できます。

## 推奨シナリオ

1. Regular + Bold を追加。
2. `sources/sample.html` と `sample-utf16.txt` を文字ソースへ追加。
3. `BKTest-ASCII.ttf` で日本語が不足文字として表示されることを確認。
4. Restricted / NoSubsetting / BitmapOnly を追加し、生成制御を確認。
5. Regular + Bold を family `BK Test Web`、weight 400 / 700 で生成し、Webfont Package ZIPを保存。

## expected

- `webfont-package.zip`: Regular + Bold をこのv1.0.0で生成した期待出力例。`fonts.css`、2本のWOFF2、`demo.html`、`manifest.json`を含みます。

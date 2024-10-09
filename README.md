# MDConverter
Convert Markdown files to PDFs or Html files

### Install
```
yarn
yarn build
yarn link
```

### Usage
```
mkdown -i <input.md> -o "<output.html|pdf>"
```

### Custom Flavouring
- All Github Markdown flavours
- `::pagebreak`: force a pagebreak on pdf

### Metadata
```
title: XYZ
```
Will allow the injection of the html title on output

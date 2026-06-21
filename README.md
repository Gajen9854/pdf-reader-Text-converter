# pdf-reader-Text-converter
Pdf reader to Text convertor with dictionary function
# PDF Reader App with Dictionary

A client-side PDF reader application with the following features:
- View PDF documents directly in the browser
- Extract and display text content
- Look up words in a dictionary (using free API)
- Toggle night mode for better reading experience
- Text reader view for easier reading of extracted content
- No server required - works entirely in the browser

## How to Use

1. Upload a PDF file by clicking the "Choose File" button or dragging and dropping it into the viewer
2. Use the "Text Reader" button to switch between PDF view and extracted text view
3. Double-click on any word in the text reader to look up its definition
4. Toggle night mode for better reading conditions

## Features

- **PDF Viewing**: Render PDFs using Mozilla's PDF.js library
- **Text Extraction**: Extract all text content from PDF documents
- **Dictionary Lookup**: Get definitions, pronunciations, and examples using DictionaryAPI
- **Night Mode**: Toggle between light and dark themes for comfortable reading
- **Text Reader**: Clean view of extracted text with word selection capabilities
- **Drag and Drop**: Easy file upload via drag and drop

## Technical Details

- Uses PDF.js from Mozilla for client-side PDF rendering
- Stores user preferences (like night mode) in localStorage
- Implements DictionaryAPI for word definitions
- Responsive design that works on different screen sizes
- Pure JavaScript with no server requirements

## Limitations

- Requires internet connection for dictionary lookups
- Large PDF files may take longer to load and extract text
- Some complex PDF layouts may not render perfectly

## How to Run

Simply open the `index.html` file in a modern web browser. No additional setup or server required.

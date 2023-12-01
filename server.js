const fs = require('fs');
const pdf = require('pdf-parse');
require('dotenv').config()
//add express
const express = require('express');
const app = express();
const port = 3000;
const axios = require('axios');


app.use(express.json());

k = process.env.PINE;

openai = process.env.OPENAI;

pineurl = process.env.URL;
console.log(openai);
async function upsertToPinecone(pageNumber, pageText, filename, fileUrl) {
  const pineconeEndpoint = `${pineurl}/vectors/upsert`;
  const headers = {
    'accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `${openai}`,
  };



  try {
    console.log(pageText);
    const responseai = await axios.post('https://api.openai.com/v1/embeddings', {

        input: pageText,
        model: "text-embedding-ada-002"

    }, { headers });

    console.log(`Page ${pageNumber} embedded`);
console.log(responseai.data.data[0].embedding);
    try {

      const headers = {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'Api-Key': k,
      };
      
      const response = await axios.post(pineconeEndpoint, {

          vectors: [
            {
              metadata: {pagenumber: pageNumber, pdf_name: filename, text: pageText, url: fileUrl  },
              id: Math.random().toString(36).substring(2, 7),
              values: responseai.data.data[0].embedding
            }
          ]//,
          //namespace: 'pdfs'
      }, { headers });
  
      console.log(`Page ${pageNumber} upserted to Pinecone. Response:`, response.data);
    } catch (error) {
      console.error(`Error upserting page ${pageNumber} to Pinecone:`, error);
    }

  } catch (error) {
    console.error(`Error embedding ${pageNumber}`,error.message);
  }

 
}

console.log(k);
app.post('/upsert', async (req, res) => {
    try {
  
      const { fileUrl, filename } = req.body;

      console.log('Request Body:', req.body);

      if (!fileUrl) {
        return res.status(400).json({ error: 'fileUrl is required' });
      }
  
      // Parse the PDF
      const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      const dataBuffer = Buffer.from(response.data);
  
      // Parse the PDF
      const pdfData = await pdf(dataBuffer);
  
      // Extract text from each page
      const pages = pdfData.text.split('\n\n');
  
      // Filter and store pages with content longer than 20 charactersq
    
      pages.forEach(async (pageText, index) => {
        if (pageText.length > 20) {
          await upsertToPinecone(index, pageText, filename, fileUrl);
        }
      });

      const result = pages
      .filter((pageText, index) => pageText.length > 20)
      .map((pageText, index) => ({ pageNumber: index + 1, text: pageText }));
console.log(result)

    res.json({ result });
  } catch (error) {
    console.error('Error processing the PDF:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.post('/upload', async (req, res) => {
  try {

    const { fileUrls } = req.body;

    console.log('Request Body:', req.body);

    // Parse the PDF
    async function fetchMetadata(url) {
      try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const dataBuffer = Buffer.from(response.data);
        const data = await pdf(dataBuffer);
        const metadata = data.info.Title;
    
        return metadata;
      } catch (error) {
        console.error('Error:', error);
        return null;
      }
    }
    
    async function processUrls() {
      const metadataArray = [];
    
      for (const url of fileUrls) {
        const metadata = await fetchMetadata(url);
        if (metadata !== null) {
          metadataArray.push({ url, name: metadata });
        }
      }
    
      // Output the metadata array as JSON
      const result = JSON.stringify(metadataArray);
      console.log(result);
      res.json({ result });
    }
    
    // Call the function to start processing URLs
    processUrls();


} catch (error) {
  console.error('Error processing the PDF:', error);
  res.status(500).json({ error: 'Internal server error' });
}
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
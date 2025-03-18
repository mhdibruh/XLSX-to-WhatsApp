import { useState } from 'react';
import * as XLSX from 'xlsx';
import './App.css';

function App() {
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [noWebsiteContacts, setNoWebsiteContacts] = useState([]);
  const [showWarning, setShowWarning] = useState(true);
  const [senderNumber, setSenderNumber] = useState('');
  const [batchSize] = useState(10);
  const [currentBatch, setCurrentBatch] = useState(0);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setStatus('No file selected.');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setStatus(`Reading file: ${file.name}...`);

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: false,
          defval: ''
        });

        // Find relevant column indices
        const headers = jsonData[0];
        const phoneColumnIndex = headers.findIndex(header => 
          header.toLowerCase() === 'phone'
        );
        const websiteColumnIndex = headers.findIndex(header => 
          header.toLowerCase() === 'website'
        );
        const titleColumnIndex = headers.findIndex(header => 
          header.toLowerCase() === 'title'
        );

        if (phoneColumnIndex === -1) {
          setStatus('❌ No phone column found in the file.');
          return;
        }

        // Process phone numbers and check websites
        const processedNumbers = [];
        const noWebsiteBusinesses = [];

        jsonData.slice(1).forEach(row => {
          if (!row[phoneColumnIndex]) return;
          
          let number = String(row[phoneColumnIndex]).trim();
          number = number.replace(/[\s-]/g, '');
          
          if (number && number.length > 8) {
            if (!number.startsWith('+')) {
              number = '+' + number;
            }
            processedNumbers.push(number);

            // Check if business has no website
            const website = row[websiteColumnIndex]?.trim();
            if (!website) {
              noWebsiteBusinesses.push({
                title: row[titleColumnIndex] || 'Unnamed Business',
                phone: number
              });
            }
          }
        });

        if (processedNumbers.length === 0) {
          setStatus('❌ No valid phone numbers found in the file.');
          return;
        }

        setPhoneNumbers(processedNumbers);
        setNoWebsiteContacts(noWebsiteBusinesses);
        setStatus(`✅ Successfully loaded ${processedNumbers.length} phone numbers`);
      } catch (error) {
        console.error('Error processing file:', error);
        setStatus('❌ Error processing file. Please check the format.');
      }
    };

    reader.onerror = (error) => {
      console.error('File reading error:', error);
      setStatus('❌ Error reading file. Please try again.');
      setSelectedFile(null);
    };

    reader.readAsBinaryString(file);
  };

  const sendMessages = async () => {
    if (!message || phoneNumbers.length === 0) {
      setStatus('Please provide both message and phone numbers');
      return;
    }

    if (!senderNumber) {
      setStatus('❌ Please enter your WhatsApp number');
      return;
    }

    try {
      const encodedMessage = encodeURIComponent(message);
      const totalBatches = Math.ceil(phoneNumbers.length / batchSize);
      let currentNumber = 0;

      for (let batchIndex = currentBatch; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * batchSize;
        const end = Math.min(start + batchSize, phoneNumbers.length);
        const currentBatchNumbers = phoneNumbers.slice(start, end);
        
        setStatus(`Opening batch ${batchIndex + 1}/${totalBatches} (${start + 1}-${end} of ${phoneNumbers.length})`);

        // Open all numbers in current batch simultaneously
        currentBatchNumbers.forEach(number => {
          const cleanNumber = number.replace(/[^\d+]/g, '');
          // Using web.whatsapp.com directly
          const whatsappUrl = `https://web.whatsapp.com/send?phone=${cleanNumber}&text=${encodedMessage}`;
          window.open(whatsappUrl, `whatsapp_${cleanNumber}`); // Named window for better tracking
          currentNumber++;
        });

        // If not the last batch, wait for user confirmation
        if (batchIndex < totalBatches - 1) {
          await new Promise(resolve => {
            setStatus(`✅ Batch ${batchIndex + 1}: Send all messages before continuing.
              1. Wait for each chat to load
              2. Click send (green button) in each tab
              3. Keep tabs open until messages are sent
              4. Click 'Continue' for next batch`);
            const continueBtn = document.createElement('button');
            continueBtn.textContent = 'Continue with Next Batch';
            continueBtn.className = 'continue-button';
            continueBtn.onclick = () => resolve();
            document.querySelector('.status-message').appendChild(continueBtn);
          });
        }
      }

      setStatus(`✅ All chats opened! Remember to:
        1. Wait for each chat to load
        2. Send each message
        3. Close tabs after sending`);
      setCurrentBatch(0);
    } catch (error) {
      console.error('Error opening chats:', error);
      setStatus('❌ Error opening chats: ' + error.message);
    }
  };

  return (
    <div className="app-container">
      <div className="content-container">
        <h1 className="app-title">Bulk Message Sender</h1>

        <div className="section upload-section">
          <h2>1. Upload Excel File</h2>
          <div className="file-upload-container">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="file-input"
              id="file-upload"
            />
            {selectedFile && (
              <div className="selected-file">
                <span className="file-icon">📄</span>
                <span className="file-name">{selectedFile.name}</span>
              </div>
            )}
          </div>
          <p className="upload-hint">
            Excel file should have a "phone" column with phone numbers
          </p>
        </div>

        <div className="section message-section">
          <h2>2. Your Information</h2>
          <div className="sender-input-container">
            <label htmlFor="sender-number">Your WhatsApp Number</label>
            <input
              id="sender-number"
              type="text"
              value={senderNumber}
              onChange={(e) => setSenderNumber(e.target.value)}
              placeholder="+212XXXXXXXXX"
              className="sender-input"
            />
          </div>
          <div className="message-input-container">
            <label htmlFor="message">Message to Send</label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your message here..."
              rows={4}
              className="message-input"
            />
          </div>
        </div>

        <div className="section preview-section">
          <h2>3. Preview</h2>
          <p className="numbers-count">Numbers loaded: {phoneNumbers.length}</p>
          <div className="numbers-preview">
            {phoneNumbers.length > 0 ? (
              <>
                {phoneNumbers.map((number, index) => (
                  <div key={index} className="number-item">
                    <span className="number-index">{index + 1}.</span>
                    <span className="number-value">{number}</span>
                  </div>
                ))}
              </>
            ) : (
              <div className="no-numbers">No phone numbers loaded yet</div>
            )}
          </div>
        </div>

        <div className="section preview-section">
          <h2>4. Businesses Without Websites</h2>
          <p className="numbers-count">
            Businesses found: {noWebsiteContacts.length}
          </p>
          <div className="numbers-preview">
            {noWebsiteContacts.length > 0 ? (
              <>
                {noWebsiteContacts.map((business, index) => (
                  <div key={index} className="business-item">
                    <span className="number-index">{index + 1}.</span>
                    <div className="business-details">
                      <span className="business-title">{business.title}</span>
                      <span className="business-phone">{business.phone}</span>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="no-numbers">No businesses without websites found</div>
            )}
          </div>
        </div>

        {showWarning && (
          <div className="whatsapp-warning">
            <div className="warning-content">
              <h3>⚠️ WhatsApp Web Automation</h3>
              <p>The process will:</p>
              <ol className="warning-steps">
                <li>Open WhatsApp Web for each number</li>
                <li>Attempt to send message automatically</li>
                <li>Close the window after sending</li>
                <li>Continue with next number</li>
              </ol>
              <p className="warning-note">
                Important: Keep the app window open during the process.
                Make sure you're logged into WhatsApp Web first!
              </p>
              <button 
                className="warning-button"
                onClick={() => setShowWarning(false)}
              >
                I understand
              </button>
            </div>
          </div>
        )}

        <button
          onClick={sendMessages}
          className="send-button"
          disabled={!message || phoneNumbers.length === 0}
        >
          Send Messages
        </button>

        {status && (
          <div className={`status-message ${
            status.startsWith('✅') ? 'success' : 
            status.startsWith('❌') ? 'error' : 'info'
          }`}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
import { useState } from 'react'
import './App.css'

function App() {
  const [transcript, setTranscript] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [summary, setSummary] = useState('')
  const [editableSummary, setEditableSummary] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [emailRecipients, setEmailRecipients] = useState('')
  const [emailSubject, setEmailSubject] = useState('Meeting Summary')
  const [emailSenderName, setEmailSenderName] = useState('Meeting Summarizer')
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState(null)
  const [showEmailForm, setShowEmailForm] = useState(false)

  const generateSummary = async () => {
    // Validate transcript
    if (!transcript.trim()) {
      setError('Please enter a transcript to summarize');
      return;
    }
    
    // Check if transcript is too short
    if (transcript.trim().length < 20) {
      setError('Transcript is too short. Please provide more content to summarize.');
      return;
    }
    
    // Check if transcript is too long
    if (transcript.length > 100000) {
      setError('Transcript is too long (over 100,000 characters). Please shorten it before generating a summary.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // Create an AbortController to handle timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/generate-summary`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            transcript, 
            customPrompt: customPrompt.trim() 
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        
        // Handle HTTP errors
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Server responded with status: ${response.status}`);
        }
        
        // Parse response data
        const data = await response.json();
        
        if (!data.summary || typeof data.summary !== 'string') {
          throw new Error('Received invalid summary format from the server');
        }

        // Update state with the received summary
        setSummary(data.summary);
        setEditableSummary(data.summary);
        
        // Reset email form state
        setShowEmailForm(false);
        setEmailSent(false);
        setEmailError(null);
        
        // Log metadata if available
        if (data.metadata) {
          console.log('Summary generated using:', data.metadata.service);
          console.log('Summary length:', data.metadata.summaryLength, 'characters');
        }
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timed out. The server took too long to respond.');
        } else {
          throw fetchError;
        }
      }
    } catch (err) {
      setError(err.message || 'An unknown error occurred');
      console.error('Summary generation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const sendEmail = async () => {
    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // Validate recipients
    if (!emailRecipients.trim()) {
      setEmailError('Please enter at least one recipient email');
      return;
    }

    // Validate summary content
    if (!editableSummary.trim()) {
      setEmailError('There is no summary to send');
      return;
    }
    
    // Process recipients
    const recipients = emailRecipients
      .split(',')
      .map(email => email.trim())
      .filter(email => email);
    
    // Check if we have recipients
    if (recipients.length === 0) {
      setEmailError('Please enter valid recipient email addresses');
      return;
    }
    
    // Validate email format
    const invalidEmails = recipients.filter(email => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      setEmailError(`Invalid email format: ${invalidEmails.join(', ')}`);
      return;
    }
    
    // Limit number of recipients
    if (recipients.length > 20) {
      setEmailError('Too many recipients. Please limit to 20 email addresses.');
      return;
    }
    
    // Validate subject
    if (!emailSubject.trim()) {
      setEmailError('Email subject cannot be empty');
      return;
    }
    
    try {
      setIsLoading(true);
      setEmailError(null);
      
      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipients,
            subject: emailSubject.trim(),
            summary: editableSummary,
            senderName: emailSenderName.trim() || 'Meeting Summarizer',
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        
        // Handle non-JSON responses
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Server returned an invalid response format');
        }

        const data = await response.json();
        
        if (!response.ok) {
          // Check if server returned detailed error info
          if (data.error) {
            throw new Error(data.error);
          } else if (data.details) {
            throw new Error(`${data.error}: ${data.details}`);
          } else {
            throw new Error(`Server error: ${response.status}`);
          }
        }

        // Show success message with recipient count
        setEmailSent(true);
        console.log(`Email sent successfully to ${recipients.length} recipient(s)`);
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') {
          throw new Error('Email sending timed out. Please try again later.');
        } else {
          throw fetchError;
        }
      }
    } catch (err) {
      setEmailError(err.message || 'An unknown error occurred when sending email');
      console.error('Email sending error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file size (limit to 10MB)
    const maxSizeInBytes = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSizeInBytes) {
      setError(`File size exceeds the 10MB limit. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`);
      return;
    }
    
    // Check file type
    const allowedTypes = ['.txt', '.md', '.doc', '.docx', '.pdf'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      setError(`File type "${fileExtension}" is not supported. Please use: ${allowedTypes.join(', ')}`);
      return;
    }
    
    setError(null); // Clear any previous errors
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        // For text files, we can directly use the result
        const content = e.target.result;
        
        // If the file is too large (over 100k chars), truncate it
        if (content.length > 100000) {
          setTranscript(content.substring(0, 100000));
          setError('File content was too large and has been truncated to 100,000 characters');
        } else {
          setTranscript(content);
        }
      } catch (error) {
        setError(`Failed to read file: ${error.message}`);
      }
    };
    
    reader.onerror = () => {
      setError('Failed to read the file. Please try again with a different file.');
    };
    
    reader.readAsText(file);
  };

  return (
    <div className="app-container">
      <header>
        <h1>AI Meeting Summarizer</h1>
        <p>Upload a transcript, add custom instructions, and generate an AI-powered summary</p>
      </header>

      <main>
        <section className="input-section">
          <div className="form-group">
            <label htmlFor="transcript">Meeting Transcript</label>
            <div className="upload-container">
              <textarea
                id="transcript"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Paste your meeting transcript here..."
                rows={10}
              />
              <div className="file-upload">
                <label htmlFor="file-upload" className="file-upload-label">
                  Upload Transcript File
                </label>
                <input
                  type="file"
                  id="file-upload"
                  accept=".txt,.md,.doc,.docx,.pdf"
                  onChange={handleFileUpload}
                />
                <span className="file-format-note">
                  Supported formats: .txt, .md, .doc, .docx, .pdf
                </span>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="custom-prompt">Custom Instructions (Optional)</label>
            <input
              type="text"
              id="custom-prompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g., 'Summarize in bullet points for executives' or 'Highlight action items only'"
            />
          </div>

          <button 
            className="generate-btn"
            onClick={generateSummary}
            disabled={isLoading || !transcript.trim()}
          >
            {isLoading ? 'Generating... This may take a moment' : 'Generate Summary'}
          </button>

          {error && <div className="error-message">
            <strong>Error:</strong> {error}
          </div>}
          
          {isLoading && (
            <div className="loading-indicator">
              <div className="loading-spinner"></div>
              <p>Generating summary, please wait...</p>
              <p className="loading-note">This can take up to a minute depending on transcript length</p>
            </div>
          )}
        </section>

        {summary && (
          <section className="output-section">
            <h2>Generated Summary</h2>
            
            <div className="summary-editor">
              <textarea
                value={editableSummary}
                onChange={(e) => setEditableSummary(e.target.value)}
                rows={12}
              />
            </div>

            <div className="action-buttons">
              <button 
                className="share-btn"
                onClick={() => setShowEmailForm(!showEmailForm)}
              >
                Share via Email
              </button>
            </div>

            {showEmailForm && (
              <div className="email-form">
                <h3>Share Summary via Email</h3>
                
                <div className="form-group">
                  <label htmlFor="email-recipients">Recipients (comma separated)</label>
                  <input
                    type="text"
                    id="email-recipients"
                    value={emailRecipients}
                    onChange={(e) => setEmailRecipients(e.target.value)}
                    placeholder="email1@example.com, email2@example.com"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="email-subject">Subject</label>
                  <input
                    type="text"
                    id="email-subject"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="email-sender">Sender Name</label>
                  <input
                    type="text"
                    id="email-sender"
                    value={emailSenderName}
                    onChange={(e) => setEmailSenderName(e.target.value)}
                  />
                </div>

                <button 
                  className="send-email-btn"
                  onClick={sendEmail}
                  disabled={isLoading}
                >
                  {isLoading ? 'Sending...' : 'Send Email'}
                </button>
                
                {emailSent && (
                  <div className="success-message">
                    <strong>Success!</strong> Email sent successfully!
                  </div>
                )}
                
                {emailError && (
                  <div className="error-message">
                    <strong>Error:</strong> {emailError}
                  </div>
                )}
                
                {isLoading && emailRecipients && (
                  <div className="loading-indicator">
                    <div className="loading-spinner"></div>
                    <p>Sending email, please wait...</p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

export default App

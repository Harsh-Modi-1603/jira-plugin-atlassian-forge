import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [userStory, setUserStory] = useState('');
  const [jiraId, setJiraId] = useState('');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('');
  const [error, setError] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);
  const [isJiraLoading, setIsJiraLoading] = useState(true); // NEW STATE

  useEffect(() => {
    const fetchJiraData = async () => {
      try {
        const res = await invoke('getJiraIssueInfo');
        const storyTitle = res.userStory?.trim() || '';
        const storyDescription = res.acceptanceCriteria?.trim() || '';
        const combined = `${storyTitle}\n\n${storyDescription}`.trim();
        setUserStory(combined);
        setJiraId(res.jiraId);
        setAcceptanceCriteria(storyDescription);
      } catch (err) {
        setError('Failed to fetch Jira data.');
      } finally {
        setIsJiraLoading(false); // Ensure loading ends
      }
    };
    fetchJiraData();
  }, []);

  const handleGenerate = async () => {
    if (!userStory || !jiraId) {
      setError('User story data is missing. Please check the Jira issue.');
      return;
    }

    if (input.length > 400) return;

    setIsProcessing(true);
    setError('');

    try {
      let res, data;

      if (input.trim()) {
        res = await fetch('https://llm-api-inv4.onrender.com/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: input.trim(), jira_id: jiraId })
        });
        data = await res.json();
        setMessages(prev => [
          ...prev,
          { role: 'user', text: input.trim() },
          { role: 'ai', text: data.response }
        ]);
      } else {
      res = await fetch('https://llm-api-inv4.onrender.com/chat-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_story: userStory.trim(),
          jira_id: jiraId,
          acceptance_criteria: acceptanceCriteria.trim()
        })
      });
      data = await res.json();
        setMessages(prev => [
          ...prev,
          { role: 'ai', text: data.testCases }
        ]);
        setHasGeneratedOnce(true);
        // renderTableFromJson(data.testCases);
        // downloadCSVFromJsonArray(data.testCases);
      }

      setInput('');
      setCharCount(0);
    } catch (err) {
      setError('Network error. Please try again.');
    }

    setIsProcessing(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);
    setCharCount(value.length);
    if (value.trim()) {
      setHasGeneratedOnce(false);
    }
  };

  const copyTestCases = () => {
    const latestAiMessage = [...messages].reverse().find(msg => msg.role === 'ai');
    if (latestAiMessage) {
      navigator.clipboard.writeText(latestAiMessage.text)
        .then(() => alert('Test cases copied to clipboard!'))
        .catch(() => alert('Failed to copy test cases.'));
    }
  };

  return (
    <div className="container">
      {error && <div className="error-msg">{error}</div>}
      {isJiraLoading && <div className="loading-msg">Fetching Jira data...</div>}

      <div className="message-list">
        {messages.map((msg, idx) => {
          const isLatestAi = msg.role === 'ai' && idx === messages.length - 1;
          return (
            <div key={idx} className={`msg ${msg.role === 'user' ? 'user-msg' : 'ai-msg'}`}>
              {isLatestAi && (
                <div className="copy-container">
                  <span className="copy-text" onClick={copyTestCases}>Copy</span>
        </div>
      )}
              {msg.text}
              </div>
          );
        })}
          </div>

      <form className="chat-input-wrapper" onSubmit={(e) => e.preventDefault()}>
        <div className="input-wrapper">
          <div className="char-indicator">{charCount}/400</div>
          <input
            className={`chat-input ${charCount > 400 ? 'input-error' : ''}`}
            placeholder="Type here or hit generate to get test cases."
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            disabled={isProcessing || isJiraLoading}
          />
          {charCount > 400 && <div className="char-error-msg">Character limit exceeded</div>}
        </div>

        <button
          className={`btn chat-btn ${(isProcessing || charCount > 400 || hasGeneratedOnce || isJiraLoading) ? 'btn-disabled' : ''}`}
          onClick={handleGenerate}
          disabled={isProcessing || charCount > 400 || hasGeneratedOnce || isJiraLoading}
        >
          {isProcessing ? 'Processing...' : 'Generate'}
          </button>
      </form>
    </div>
  );
}

function downloadCSVFromJsonArray(jsonString, filename = 'test_cases.csv') {
  let jsonArray;
  try {
    jsonArray = JSON.parse(jsonString);
  } catch (e) {
    alert("Failed to parse test cases JSON.");
    return;
  }

  if (!Array.isArray(jsonArray) || jsonArray.length === 0) {
    alert("No test cases found to export.");
    return;
  }

  const csvRows = [];
  const headers = Object.keys(jsonArray[0]);
  csvRows.push(headers.join(','));

  for (const row of jsonArray) {
    const values = headers.map(header => {
      const val = row[header] !== null && row[header] !== undefined ? row[header] : '';
      return `"${String(val).replace(/"/g, '""')}"`; // Escape double quotes
    });
    csvRows.push(values.join(','));
  }

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function renderTableFromJson(jsonString, containerId = 'table-container') {
  let jsonArray;
  try {
    jsonArray = JSON.parse(jsonString);
  } catch (e) {
    document.getElementById(containerId).innerHTML = '<p>Failed to parse test cases JSON.</p>';
    return;
  }

  if (!Array.isArray(jsonArray) || jsonArray.length === 0) {
    document.getElementById(containerId).innerHTML = '<p>No test cases to display.</p>';
    return;
  }

  const headers = Object.keys(jsonArray[0]);
  let html = '<table border="1" style="border-collapse: collapse; width: 100%"><thead><tr>';

  headers.forEach(h => {
    html += `<th>${h}</th>`;
  });
  html += '</tr></thead><tbody>';

  jsonArray.forEach(row => {
    html += '<tr>';
    headers.forEach(h => {
      html += `<td>${row[h] ?? ''}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  document.getElementById(containerId).innerHTML = html;
}


export default App;


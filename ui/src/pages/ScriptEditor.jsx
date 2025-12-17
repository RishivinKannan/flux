import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import api from '../services/api';
import Spinner from '../components/Spinner';

const DEFAULT_SCRIPT = `/**
 * Transformation Script
 * 
 * Export any of these functions to transform requests:
 * - transformHeaders(headers) => headers
 * - transformParams(params) => params
 * - transformBody(body) => body
 */

export default {
  transformHeaders: (headers, metadata) => {
    // Add or modify headers
    return {
      ...headers,
      // 'X-Custom-Header': 'value'
    };
  },

  transformParams: (params, metadata) => {
    // Add or modify query parameters
    return {
      ...params,
      // timestamp: Date.now()
    };
  },

  transformBody: (body, metadata) => {
    // Transform request body
    if (!body) return body;
    
    return {
      ...body,
      // transformed: true
    };
  }
};
`;

const DEFAULT_MOCK = `{
  "status": 200,
  "statusText": "OK",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "message": "Mock response"
  }
}`;

function ScriptEditor() {
    const { name } = useParams();
    const navigate = useNavigate();
    const isEditMode = !!name;

    const [scriptName, setScriptName] = useState(name || '');
    const [content, setContent] = useState(DEFAULT_SCRIPT);
    const [tags, setTags] = useState('');
    const [pathPattern, setPathPattern] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(isEditMode);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [targets, setTargets] = useState([]);

    // Response config state
    const [responseEnabled, setResponseEnabled] = useState(false);
    const [responseStrategy, setResponseStrategy] = useState('first');
    const [responseTargetId, setResponseTargetId] = useState('');
    const [responseMock, setResponseMock] = useState(DEFAULT_MOCK);
    const [responseMockForce, setResponseMockForce] = useState(false);
    const [showResponseSection, setShowResponseSection] = useState(false);

    useEffect(() => {
        loadData();
    }, [name]);

    const loadData = async () => {
        try {
            setLoading(true);

            // Load targets for response config dropdown
            const targetsData = await api.fetchTargets();
            setTargets(targetsData.targets || []);

            if (isEditMode) {
                const data = await api.getScript(name);
                setContent(data.content);

                // Load metadata if available
                if (data.metadata) {
                    setTags((data.metadata.tags || []).join(', '));
                    setPathPattern(data.metadata.pathPattern || '');
                    setDescription(data.metadata.description || '');
                }

                // Load response config
                if (data.responseConfig) {
                    setResponseEnabled(data.responseConfig.enabled || false);
                    setResponseStrategy(data.responseConfig.strategy || 'first');
                    setResponseTargetId(data.responseConfig.targetId || '');
                    setResponseMockForce(data.responseConfig.mockForce !== false);
                    if (data.responseConfig.mockResponse) {
                        setResponseMock(JSON.stringify(data.responseConfig.mockResponse, null, 2));
                    }
                    setShowResponseSection(data.responseConfig.enabled);
                }
            }

            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        // Prevent duplicate saves
        if (saving) {
            return;
        }

        // Set saving state immediately for instant UI feedback
        setSaving(true);
        setError(null);
        setSuccess(null);

        // Validate inputs
        if (!scriptName.trim()) {
            setError('Script name is required');
            setSaving(false);
            return;
        }

        // Parse mock response if strategy is 'mock'
        let mockResponse = null;
        if (responseStrategy === 'mock' && responseEnabled) {
            try {
                mockResponse = JSON.parse(responseMock);
            } catch (err) {
                setError('Invalid JSON in mock response');
                setSaving(false);
                return;
            }
        }

        // Parse tags from comma-separated string
        const tagsArray = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);

        try {
            // Build response config
            const responseConfig = {
                strategy: responseStrategy,
                targetId: responseTargetId || null,
                mockResponse: mockResponse,
                mockForce: responseMockForce,
                enabled: responseEnabled
            };

            if (isEditMode) {
                await api.updateScript(name, content);
                // Update metadata with response config
                await api.updateScriptMetadata(name, tagsArray, description, pathPattern, responseConfig);
                setSuccess('Script updated successfully!');
            } else {
                await api.createScript(scriptName, content);
                // Update metadata for new script
                await api.updateScriptMetadata(scriptName, tagsArray, description, pathPattern, responseConfig);
                setSuccess('Script created successfully!');
                setTimeout(() => navigate('/'), 1500);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="container">
                <div className="loading">Loading script</div>
            </div>
        );
    }

    return (
        <div className="container">
            <div className="page-header">
                <h1 className="page-title">
                    {isEditMode ? `Edit: ${name}` : 'Create New Script'}
                </h1>
                <p className="page-subtitle">
                    Write JavaScript transformation functions
                </p>
            </div>

            {error && (
                <div className="error">
                    <strong>Error:</strong> {error}
                </div>
            )}

            {success && (
                <div className="success">
                    <strong>Success:</strong> {success}
                </div>
            )}

            {/* Script Details Section */}
            <div className="settings-section">
                <h2 className="section-title">
                    <span className="section-icon">📝</span>
                    Script Details
                </h2>

                {!isEditMode && (
                    <div className="form-group">
                        <label htmlFor="scriptName">Script Name</label>
                        <input
                            id="scriptName"
                            type="text"
                            value={scriptName}
                            onChange={(e) => setScriptName(e.target.value)}
                            placeholder="my-transformation"
                            pattern="[a-zA-Z0-9_-]+"
                            className="form-input"
                        />
                        <small className="form-hint">
                            Only alphanumeric characters, hyphens, and underscores allowed
                        </small>
                    </div>
                )}

                <div className="form-row">
                    <div className="form-group flex-1">
                        <label htmlFor="tags">Tags</label>
                        <input
                            id="tags"
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            placeholder="production, api, v2"
                            className="form-input"
                        />
                        <small className="form-hint">
                            Comma-separated tags - script runs for matching targets
                        </small>
                    </div>

                    <div className="form-group flex-1">
                        <label htmlFor="pathPattern">Path Pattern</label>
                        <input
                            id="pathPattern"
                            type="text"
                            value={pathPattern}
                            onChange={(e) => setPathPattern(e.target.value)}
                            placeholder="^/track/.*"
                            className="form-input"
                        />
                        <small className="form-hint">
                            Regex pattern to match request paths
                        </small>
                    </div>
                </div>

                <div className="form-group">
                    <label htmlFor="description">Description</label>
                    <input
                        id="description"
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief description of what this script does"
                        className="form-input"
                    />
                </div>
            </div>

            {/* Response Selection Section */}
            <div className="settings-section response-section">
                <div
                    className="section-header-toggle"
                    onClick={() => setShowResponseSection(!showResponseSection)}
                >
                    <h2 className="section-title">
                        <span className="section-icon">🎯</span>
                        Response Selection
                        {responseEnabled && <span className="badge badge-active">Active</span>}
                    </h2>
                    <span className={`chevron ${showResponseSection ? 'open' : ''}`}>▼</span>
                </div>

                {showResponseSection && (
                    <div className="section-content">
                        <div className="toggle-container">
                            <label className="toggle-label">
                                <input
                                    type="checkbox"
                                    checked={responseEnabled}
                                    onChange={(e) => setResponseEnabled(e.target.checked)}
                                    className="toggle-checkbox"
                                />
                                <span className="toggle-switch"></span>
                                <span className="toggle-text">Enable Response Selection for this script</span>
                            </label>
                            <p className="form-hint">
                                When enabled, this script controls which target response is returned
                            </p>
                        </div>

                        <div className="strategy-grid">

                            <div
                                className={`strategy-card ${responseStrategy === 'specific' ? 'active' : ''}`}
                                onClick={() => setResponseStrategy('specific')}
                            >
                                <div className="strategy-icon">🎯</div>
                                <div className="strategy-info">
                                    <strong>Specific Target</strong>
                                    <p>Return response from one target</p>
                                </div>
                                <div className="strategy-check">
                                    {responseStrategy === 'specific' && '✓'}
                                </div>
                            </div>

                            <div
                                className={`strategy-card ${responseStrategy === 'first' ? 'active' : ''}`}
                                onClick={() => setResponseStrategy('first')}
                            >
                                <div className="strategy-icon">⚡</div>
                                <div className="strategy-info">
                                    <strong>First Response</strong>
                                    <p>Return the fastest response</p>
                                </div>
                                <div className="strategy-check">
                                    {responseStrategy === 'first' && '✓'}
                                </div>
                            </div>

                            <div
                                className={`strategy-card ${responseStrategy === 'mock' ? 'active' : ''}`}
                                onClick={() => setResponseStrategy('mock')}
                            >
                                <div className="strategy-icon">🎭</div>
                                <div className="strategy-info">
                                    <strong>Mock Response</strong>
                                    <p>Return a custom mock</p>
                                </div>
                                <div className="strategy-check">
                                    {responseStrategy === 'mock' && '✓'}
                                </div>
                            </div>
                        </div>

                        {/* Specific Target Dropdown */}
                        {responseStrategy === 'specific' && (
                            <div className="form-group strategy-config">
                                <label htmlFor="responseTargetId">Select Target</label>
                                <select
                                    id="responseTargetId"
                                    value={responseTargetId}
                                    onChange={(e) => setResponseTargetId(e.target.value)}
                                    className="form-input"
                                >
                                    <option value="">-- Select a target --</option>
                                    {targets
                                        .filter(target => {
                                            // Get script tags as array
                                            const scriptTags = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
                                            // If no script tags, show all targets
                                            if (scriptTags.length === 0) return true;
                                            // Filter targets that have matching tags
                                            const targetTags = target.tags || [];
                                            return scriptTags.some(st => targetTags.includes(st));
                                        })
                                        .map(target => (
                                            <option key={target.id} value={target.id}>
                                                {target.nickname} ({target.baseUrl})
                                            </option>
                                        ))
                                    }
                                </select>
                            </div>
                        )}

                        {/* Mock Response Editor */}
                        {responseStrategy === 'mock' && (
                            <div className="form-group strategy-config">
                                <label>Mock Response (JSON)</label>
                                <div className="mock-editor-container">
                                    <Editor
                                        height="200px"
                                        defaultLanguage="json"
                                        theme="vs-dark"
                                        value={responseMock}
                                        onChange={(value) => setResponseMock(value || '')}
                                        options={{
                                            minimap: { enabled: false },
                                            fontSize: 13,
                                            lineNumbers: 'on',
                                            scrollBeyondLastLine: false,
                                            automaticLayout: true,
                                            tabSize: 2
                                        }}
                                    />
                                </div>

                                {/* Force Toggle */}
                                <div className="force-toggle-wrapper">
                                    <div className="force-toggle-header">
                                        <span className="force-label">⚡ Force Mode</span>
                                        <div 
                                            className={`force-toggle-pill ${responseMockForce ? 'active' : ''}`}
                                            onClick={() => setResponseMockForce(!responseMockForce)}
                                        >
                                            <span className={`pill-option ${!responseMockForce ? 'selected' : ''}`}>OFF</span>
                                            <span className={`pill-option ${responseMockForce ? 'selected' : ''}`}>ON</span>
                                        </div>
                                    </div>
                                    <p className={`force-description ${responseMockForce ? 'force-on' : 'force-off'}`}>
                                        {responseMockForce 
                                            ? "🔒 Always return mock response regardless of target status"
                                            : "🔓 Return mock only if targets succeed, else return last target response"
                                        }
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Code Editor Section */}
            <div className="settings-section">
                <h2 className="section-title">
                    <span className="section-icon">💻</span>
                    Transformation Code
                </h2>

                <div className="editor-container">
                    <div className="editor-header">
                        <div className="editor-title">
                            {scriptName || 'untitled'}.js
                        </div>
                        <div className="editor-actions">
                            <button
                                className="btn btn-secondary btn-small"
                                onClick={() => navigate('/')}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary btn-small"
                                onClick={handleSave}
                                disabled={saving || loading}
                            >
                                {saving ? (
                                    <>
                                        <Spinner small /> Saving...
                                    </>
                                ) : (
                                    '💾 Save Script'
                                )}
                            </button>
                        </div>
                    </div>
                    <Editor
                        height="500px"
                        defaultLanguage="javascript"
                        theme="vs-dark"
                        value={content}
                        onChange={(value) => setContent(value || '')}
                        options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            lineNumbers: 'on',
                            roundedSelection: true,
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            tabSize: 2
                        }}
                    />
                </div>
            </div>

            {/* Tips Section */}
            <div className="card tips-card">
                <h3>💡 Tips</h3>
                <ul>
                    <li>Export a default object with transformation functions</li>
                    <li>Each function is optional - only include what you need</li>
                    <li>Functions receive the original data and should return modified data</li>
                    <li>Changes are hot-reloaded automatically on the server</li>
                    <li>Use the Preview Tester to test transformations safely</li>
                </ul>
            </div>
        </div>
    );
}

export default ScriptEditor;

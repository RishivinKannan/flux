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
  transformHeaders: (headers) => {
    // Add or modify headers
    return {
      ...headers,
      'X-Custom-Header': 'value'
    };
  },

  transformParams: (params) => {
    // Add or modify query parameters
    return {
      ...params,
      timestamp: Date.now()
    };
  },

  transformBody: (body) => {
    // Transform request body
    if (!body) return body;
    
    return {
      ...body,
      transformed: true
    };
  }
};
`;

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

    useEffect(() => {
        if (isEditMode) {
            loadScript();
        }
    }, [name]);

    const loadScript = async () => {
        try {
            setLoading(true);
            const data = await api.getScript(name);
            setContent(data.content);

            // Load metadata if available
            if (data.metadata) {
                setTags((data.metadata.tags || []).join(', '));
                setPathPattern(data.metadata.pathPattern || '');
                setDescription(data.metadata.description || '');
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

        // Parse tags from comma-separated string
        const tagsArray = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);

        try {
            if (isEditMode) {
                await api.updateScript(name, content);
                // Update metadata separately
                await api.updateScriptMetadata(name, tagsArray, description, pathPattern);
                setSuccess('Script updated successfully!');
            } else {
                await api.createScript(scriptName, content);
                // Update metadata for new script
                await api.updateScriptMetadata(scriptName, tagsArray, description, pathPattern);
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
                    />
                    <small style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                        Only alphanumeric characters, hyphens, and underscores allowed
                    </small>
                </div>
            )}

            <div className="form-group">
                <label htmlFor="tags">Tags</label>
                <input
                    id="tags"
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="production, api, v2"
                />
                <small style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                    Comma-separated tags - script will only run for targets with matching tags
                </small>
            </div>

            <div className="form-group">
                <label htmlFor="pathPattern">Path Pattern (optional)</label>
                <input
                    id="pathPattern"
                    type="text"
                    value={pathPattern}
                    onChange={(e) => setPathPattern(e.target.value)}
                    placeholder="^/track/.*"
                />
                <small style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                    Regex pattern to match request path - script will only run if path matches
                </small>
            </div>

            <div className="form-group">
                <label htmlFor="description">Description (optional)</label>
                <input
                    id="description"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of what this script does"
                />
            </div>

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
                            className="btn btn-success btn-small"
                            onClick={handleSave}
                            disabled={saving || loading}
                        >
                            {saving ? (
                                <>
                                    <Spinner small /> Saving...
                                </>
                            ) : (
                                '💾 Save'
                            )}
                        </button>
                    </div>
                </div>
                <Editor
                    height="600px"
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

            <div className="card" style={{ marginTop: '1rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>💡 Tips</h3>
                <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)' }}>
                    <li>Export a default object with transformation functions</li>
                    <li>Each function is optional - only include what you need</li>
                    <li>Functions receive the original data and should return modified data</li>
                    <li>Changes are hot-reloaded automatically on the server</li>
                    <li>Use the Preview Tester to test your transformations safely</li>
                </ul>
            </div>
        </div>
    );
}

export default ScriptEditor;

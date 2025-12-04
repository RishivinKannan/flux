import React, { useState, useEffect } from 'react';
import api from '../services/api';

function PreviewTester() {
    const [scripts, setScripts] = useState([]);
    const [selectedScript, setSelectedScript] = useState('');
    const [headers, setHeaders] = useState('{\n  "Content-Type": "application/json"\n}');
    const [params, setParams] = useState('{\n  "userId": "123"\n}');
    const [body, setBody] = useState('{\n  "message": "Hello World"\n}');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadScripts();
    }, []);

    const loadScripts = async () => {
        try {
            const data = await api.fetchScripts();
            const scriptNames = (data.scripts || []).map(s => s.name);
            setScripts(scriptNames);
            if (scriptNames.length > 0 && !selectedScript) {
                setSelectedScript(scriptNames[0]);
            }
        } catch (err) {
            setError(err.message);
        }
    };

    const handlePreview = async () => {
        if (!selectedScript) {
            setError('Please select a script');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // Parse JSON inputs
            const sampleData = {
                headers: JSON.parse(headers),
                params: JSON.parse(params),
                body: JSON.parse(body)
            };

            const data = await api.previewTransformation(selectedScript, sampleData);
            setResult(data);
        } catch (err) {
            setError(err.message);
            setResult(null);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container">
            <div className="page-header">
                <h1 className="page-title">Preview Tester</h1>
                <p className="page-subtitle">
                    Test your transformation scripts with sample data
                </p>
            </div>

            {error && (
                <div className="error">
                    <strong>Error:</strong> {error}
                </div>
            )}

            <div className="card" style={{ marginBottom: '2rem' }}>
                <div className="form-group">
                    <label htmlFor="scriptSelect">Select Script</label>
                    <select
                        id="scriptSelect"
                        value={selectedScript}
                        onChange={(e) => setSelectedScript(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="">-- Select a script --</option>
                        {scripts.map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                </div>

                <button
                    className="btn btn-primary"
                    onClick={handlePreview}
                    disabled={loading || !selectedScript}
                >
                    {loading ? '🔄 Testing...' : '🧪 Test Transformation'}
                </button>
            </div>

            <div className="preview-container">
                {/* Input Section */}
                <div className="preview-section">
                    <h3>📥 Sample Input</h3>

                    <div className="preview-input">
                        <label>Headers (JSON)</label>
                        <textarea
                            value={headers}
                            onChange={(e) => setHeaders(e.target.value)}
                            rows={6}
                            style={{ width: '100%', fontFamily: 'Monaco, monospace', fontSize: '0.9rem' }}
                        />
                    </div>

                    <div className="preview-input">
                        <label>Query Parameters (JSON)</label>
                        <textarea
                            value={params}
                            onChange={(e) => setParams(e.target.value)}
                            rows={4}
                            style={{ width: '100%', fontFamily: 'Monaco, monospace', fontSize: '0.9rem' }}
                        />
                    </div>

                    <div className="preview-input">
                        <label>Body (JSON)</label>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            rows={6}
                            style={{ width: '100%', fontFamily: 'Monaco, monospace', fontSize: '0.9rem' }}
                        />
                    </div>
                </div>

                {/* Output Section */}
                <div className="preview-section">
                    <h3>📤 Transformed Output</h3>

                    {result ? (
                        <>
                            <div className="card" style={{ marginBottom: '1rem' }}>
                                <h4 style={{ marginBottom: '0.5rem' }}>Applied Transformations</h4>
                                <div style={{ color: 'var(--text-secondary)' }}>
                                    <div>✓ transformHeaders: {result.applied.transformHeaders ? '✅ Yes' : '❌ No'}</div>
                                    <div>✓ transformParams: {result.applied.transformParams ? '✅ Yes' : '❌ No'}</div>
                                    <div>✓ transformBody: {result.applied.transformBody ? '✅ Yes' : '❌ No'}</div>
                                </div>
                            </div>

                            <div className="preview-input">
                                <label>Headers</label>
                                <div className="preview-output">
                                    {JSON.stringify(result.transformed.headers, null, 2)}
                                </div>
                            </div>

                            <div className="preview-input">
                                <label>Query Parameters</label>
                                <div className="preview-output">
                                    {JSON.stringify(result.transformed.params, null, 2)}
                                </div>
                            </div>

                            <div className="preview-input">
                                <label>Body</label>
                                <div className="preview-output">
                                    {JSON.stringify(result.transformed.body, null, 2)}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="empty-state">
                            <p>Run a test to see results</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PreviewTester;

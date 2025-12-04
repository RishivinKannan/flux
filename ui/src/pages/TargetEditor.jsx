import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

function TargetEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [nickname, setNickname] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [tags, setTags] = useState('');
  const [metadataJson, setMetadataJson] = useState('{\n  "licenseKey": "your-key-here"\n}');
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (isEditMode) {
      loadTarget();
    }
  }, [id]);

  const loadTarget = async () => {
    try {
      setLoading(true);
      const target = await api.getTarget(id);
      setNickname(target.nickname);
      setBaseUrl(target.baseUrl);
      setTags((target.tags || []).join(', '));
      setMetadataJson(JSON.stringify(target.metadata || {}, null, 2));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!nickname.trim() || !baseUrl.trim()) {
      setError('Nickname and Base URL are required');
      return;
    }

    // Parse tags from comma-separated string
    const tagsArray = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);

    // Validate metadata JSON
    let metadata = {};
    try {
      metadata = JSON.parse(metadataJson);
    } catch (err) {
      setError('Invalid JSON in metadata field');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      if (isEditMode) {
        await api.updateTarget(id, { nickname, baseUrl, tags: tagsArray, metadata });
        setSuccess('Target updated successfully!');
      } else {
        await api.createTarget({ nickname, baseUrl, tags: tagsArray, metadata });
        setSuccess('Target created successfully!');
        setTimeout(() => navigate('/targets'), 1500);
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
        <div className="loading">Loading target</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">
          {isEditMode ? `Edit: ${nickname}` : 'Add New Target'}
        </h1>
        <p className="page-subtitle">
          Configure proxy target with custom metadata
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

      <div className="card">
        <div className="form-group">
          <label htmlFor="nickname">Nickname *</label>
          <input
            id="nickname"
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Production API"
          />
          <small style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'block' }}>
            Friendly name for this target
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="baseUrl">Base URL *</label>
          <input
            id="baseUrl"
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com"
          />
          <small style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'block' }}>
            Full base URL including protocol
          </small>
        </div>

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
            Comma-separated tags to control which scripts run for this target
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="metadata">Metadata (JSON)</label>
          <textarea
            id="metadata"
            value={metadataJson}
            onChange={(e) => setMetadataJson(e.target.value)}
            rows={10}
            style={{ fontFamily: 'Monaco, monospace', fontSize: '0.9rem' }}
          />
          <small style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'block' }}>
            Custom metadata accessible in transformation scripts (e.g., licenseKey, apiKey, environment)
          </small>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/targets')}
          >
            Cancel
          </button>
          <button
            className="btn btn-success"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : '💾 Save Target'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>💡 Using Metadata in Transformations</h3>
        <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          The metadata is passed as a second parameter to transformation functions:
        </p>
        <pre style={{
          background: 'var(--bg-tertiary)',
          padding: '1rem',
          borderRadius: '6px',
          overflow: 'auto'
        }}>
          <code>{`export default {
  transformHeaders: (headers, metadata) => ({
    ...headers,
    'Authorization': \`Bearer \${metadata.licenseKey}\`
  }),
  
  transformBody: (body, metadata) => ({
    ...body,
    apiKey: metadata.licenseKey,
    env: metadata.environment
  })
};`}</code>
        </pre>
      </div>
    </div>
  );
}

export default TargetEditor;

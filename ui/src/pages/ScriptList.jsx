import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function ScriptList() {
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadScripts();
  }, []);

  const loadScripts = async () => {
    try {
      setLoading(true);
      const scriptData = await api.fetchScripts();

      // API now returns objects with {name, filename, modifiedAt}, not just names
      const scriptsWithMeta = await Promise.all(
        scriptData.map(async (scriptObj) => {
          const scriptName = scriptObj.name || scriptObj;
          try {
            const details = await api.getScript(scriptName);
            return {
              name: scriptName,
              tags: details.metadata?.tags || [],
              description: details.metadata?.description || ''
            };
          } catch (e) {
            return { name: scriptName, tags: [], description: '' };
          }
        })
      );

      setScripts(scriptsWithMeta);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  const handleDelete = async (name) => {
    try {
      await api.deleteScript(name);
      setDeleteConfirm(null);
      // Small delay to allow file system to sync and script loader to update
      await new Promise(resolve => setTimeout(resolve, 100));
      await loadScripts();
    } catch (err) {
      setError(err.message);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading scripts</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Transformation Scripts</h1>
        <p className="page-subtitle">
          Manage and edit your request transformation logic
        </p>
      </div>

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={{ marginBottom: '2rem' }}>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/create')}
        >
          ➕ Create New Script
        </button>
      </div>

      {scripts.length === 0 ? (
        <div className="empty-state">
          <h3>No scripts found</h3>
          <p>Create your first transformation script to get started</p>
        </div>
      ) : (
        <div className="scripts-grid">
          {scripts.map((script) => (
            <div key={script.name} className="card script-card">
              <div className="script-info">
                <h3>{script.name}</h3>
                {script.description && (
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    {script.description}
                  </p>
                )}
                {script.tags && script.tags.length > 0 && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                    {script.tags.map(tag => (
                      <span key={tag} style={{
                        display: 'inline-block',
                        background: 'var(--bg-tertiary)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        marginRight: '0.25rem',
                        fontSize: '0.75rem',
                        color: 'var(--accent)'
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="script-actions">
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => navigate(`/edit/${script.name}`)}
                >
                  ✏️ Edit
                </button>
                <button
                  className="btn btn-danger btn-small"
                  onClick={() => setDeleteConfirm(script.name)}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Delete</h2>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>{deleteConfirm}</strong>?</p>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleDelete(deleteConfirm)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScriptList;

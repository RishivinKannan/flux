import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function TargetList() {
    const [targets, setTargets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        loadTargets();
    }, []);

    const loadTargets = async () => {
        try {
            setLoading(true);
            const data = await api.fetchTargets();
            setTargets(data.targets || []);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await api.deleteTarget(id);
            setDeleteConfirm(null);
            loadTargets();
        } catch (err) {
            setError(err.message);
        }
    };

    if (loading) {
        return (
            <div className="container">
                <div className="loading">Loading targets</div>
            </div>
        );
    }

    return (
        <div className="container">
            <div className="page-header">
                <h1 className="page-title">Proxy Targets</h1>
                <p className="page-subtitle">
                    Manage target hosts with custom metadata
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
                    onClick={() => navigate('/targets/create')}
                >
                    ➕ Add New Target
                </button>
            </div>

            {targets.length === 0 ? (
                <div className="empty-state">
                    <h3>No targets configured</h3>
                    <p>Add your first proxy target to get started</p>
                </div>
            ) : (
                <div className="scripts-grid">
                    {targets.map((target) => (
                        <div key={target.id} className="card script-card">
                            <div className="script-info">
                                <h3>{target.nickname}</h3>
                                <div className="script-meta">
                                    {target.baseUrl}
                                </div>
                                {target.tags && target.tags.length > 0 && (
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Tags: </span>
                                        {target.tags.map(tag => (
                                            <span key={tag} style={{
                                                display: 'inline-block',
                                                background: 'var(--bg-tertiary)',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '4px',
                                                marginRight: '0.25rem',
                                                fontSize: '0.8rem',
                                                color: 'var(--accent)'
                                            }}>
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {target.metadata && Object.keys(target.metadata).length > 0 && (
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        Metadata: {Object.keys(target.metadata).join(', ')}
                                    </div>
                                )}
                            </div>
                            <div className="script-actions">
                                <button
                                    className="btn btn-secondary btn-small"
                                    onClick={() => navigate(`/targets/edit/${target.id}`)}
                                >
                                    ✏️ Edit
                                </button>
                                <button
                                    className="btn btn-danger btn-small"
                                    onClick={() => setDeleteConfirm(target)}
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
                            <p>Are you sure you want to delete <strong>{deleteConfirm.nickname}</strong>?</p>
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
                                onClick={() => handleDelete(deleteConfirm.id)}
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

export default TargetList;

const API_BASE = '/api';

class ApiService {
    async fetchScripts() {
        const response = await fetch(`${API_BASE}/scripts`);
        if (!response.ok) throw new Error('Failed to fetch scripts');
        const data = await response.json();
        // Extract scripts array from response object
        return data.scripts || [];
    }

    async getScript(name) {
        const response = await fetch(`${API_BASE}/scripts/${name}`);
        if (!response.ok) throw new Error('Failed to fetch script');
        return response.json();
    }

    async createScript(name, content) {
        const response = await fetch(`${API_BASE}/scripts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, content })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create script');
        }
        return response.json();
    }

    async updateScript(name, content) {
        const response = await fetch(`${API_BASE}/scripts/${name}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update script');
        }
        return response.json();
    }

    async deleteScript(name) {
        const response = await fetch(`${API_BASE}/scripts/${name}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete script');
        return response.json();
    }

    async previewTransformation(scriptName, sampleData) {
        const response = await fetch(`${API_BASE}/scripts/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scriptName, sampleData })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Preview failed');
        }
        return response.json();
    }

    async updateScriptMetadata(name, tags, description, pathPattern) {
        const response = await fetch(`${API_BASE}/scripts/${name}/metadata`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tags, description, pathPattern })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update metadata');
        }
        return response.json();
    }

    async getInfo() {
        const response = await fetch(`${API_BASE}/info`);
        if (!response.ok) throw new Error('Failed to fetch info');
        return response.json();
    }

    // Target management
    async fetchTargets() {
        const response = await fetch(`${API_BASE}/targets`);
        if (!response.ok) throw new Error('Failed to fetch targets');
        return response.json();
    }

    async getTarget(id) {
        const response = await fetch(`${API_BASE}/targets/${id}`);
        if (!response.ok) throw new Error('Failed to fetch target');
        return response.json();
    }

    async createTarget(data) {
        const response = await fetch(`${API_BASE}/targets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create target');
        }
        return response.json();
    }

    async updateTarget(id, data) {
        const response = await fetch(`${API_BASE}/targets/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update target');
        }
        return response.json();
    }

    async deleteTarget(id) {
        const response = await fetch(`${API_BASE}/targets/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete target');
        return response.json();
    }
}

export default new ApiService();

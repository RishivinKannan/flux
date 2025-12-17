import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import api from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, FileCode, CheckCircle2, ChevronDown, ChevronUp, Target, Zap, Bot, RefreshCw } from "lucide-react";

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
                    setResponseMockForce(data.responseConfig.mockForce === true);
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
        if (saving) return;

        setSaving(true);
        setError(null);
        setSuccess(null);

        // Validate inputs
        if (!scriptName.trim()) {
            setError('Script name is required');
            setSaving(false);
            return;
        }

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

        const tagsArray = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);

        try {
            const responseConfig = {
                strategy: responseStrategy,
                targetId: responseTargetId || null,
                mockResponse: mockResponse,
                mockForce: responseMockForce,
                enabled: responseEnabled
            };

            if (isEditMode) {
                await api.updateScript(name, content);
                await api.updateScriptMetadata(name, tagsArray, description, pathPattern, responseConfig);
                setSuccess('Script updated successfully!');
            } else {
                await api.createScript(scriptName, content);
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
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6 max-w-5xl">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {isEditMode ? `Edit: ${name}` : 'Create New Script'}
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Write JavaScript transformation functions
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <Button variant="outline" onClick={() => navigate('/')}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Script
                    </Button>
                </div>
            </div>

            {error && (
                <Alert variant="destructive" className="mb-6">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {success && (
                <Alert className="mb-6 bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>{success}</AlertDescription>
                </Alert>
            )}

            <div className="grid gap-6">
                {/* Script Details */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileCode className="h-5 w-5" /> Script Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        {!isEditMode && (
                            <div className="grid gap-2">
                                <Label htmlFor="scriptName">Script Name</Label>
                                <Input
                                    id="scriptName"
                                    value={scriptName}
                                    onChange={(e) => setScriptName(e.target.value)}
                                    placeholder="my-transformation"
                                />
                                <p className="text-xs text-muted-foreground">Only alphanumeric characters, hyphens, and underscores allowed</p>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="tags">Tags</Label>
                                <Input
                                    id="tags"
                                    value={tags}
                                    onChange={(e) => setTags(e.target.value)}
                                    placeholder="production, api, v2"
                                />
                                <p className="text-xs text-muted-foreground">Comma-separated tags to match targets</p>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="pathPattern">Path Pattern</Label>
                                <Input
                                    id="pathPattern"
                                    value={pathPattern}
                                    onChange={(e) => setPathPattern(e.target.value)}
                                    placeholder="^/track/.*"
                                />
                                <p className="text-xs text-muted-foreground">Regex pattern to match request paths</p>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Input
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Brief description of what this script does"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Response Selection */}
                <Card>
                    <CardHeader
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setShowResponseSection(!showResponseSection)}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CardTitle className="flex items-center gap-2">
                                    <Target className="h-5 w-5" /> Response Selection
                                </CardTitle>
                                {responseEnabled && <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full font-medium">Active</span>}
                            </div>
                            {showResponseSection ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </div>
                    </CardHeader>

                    {showResponseSection && (
                        <CardContent className="grid gap-6 pt-0">
                            <div className="flex items-center space-x-2 border-l-4 border-primary pl-4 py-2 bg-muted/30">
                                <Switch
                                    id="response-enabled"
                                    checked={responseEnabled}
                                    onCheckedChange={setResponseEnabled}
                                />
                                <Label htmlFor="response-enabled" className="font-medium cursor-pointer">Enable Response Selection for this script</Label>
                            </div>

                            {/* Strategy Selection */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div
                                    className={`relative flex flex-col items-center justify-between rounded-md border-2 p-4 hover:bg-muted/50 cursor-pointer transition-all ${responseStrategy === 'specific' ? 'border-primary bg-primary/5' : 'border-muted'}`}
                                    onClick={() => setResponseStrategy('specific')}
                                >
                                    <Target className="h-8 w-8 mb-2 text-primary" />
                                    <div className="text-center">
                                        <div className="font-bold">Specific Target</div>
                                        <div className="text-xs text-muted-foreground">Return response from one target</div>
                                    </div>
                                    {responseStrategy === 'specific' && <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-primary" />}
                                </div>

                                <div
                                    className={`relative flex flex-col items-center justify-between rounded-md border-2 p-4 hover:bg-muted/50 cursor-pointer transition-all ${responseStrategy === 'first' ? 'border-primary bg-primary/5' : 'border-muted'}`}
                                    onClick={() => setResponseStrategy('first')}
                                >
                                    <Zap className="h-8 w-8 mb-2 text-yellow-500" />
                                    <div className="text-center">
                                        <div className="font-bold">First Response</div>
                                        <div className="text-xs text-muted-foreground">Return the fastest response</div>
                                    </div>
                                    {responseStrategy === 'first' && <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-primary" />}
                                </div>

                                <div
                                    className={`relative flex flex-col items-center justify-between rounded-md border-2 p-4 hover:bg-muted/50 cursor-pointer transition-all ${responseStrategy === 'mock' ? 'border-primary bg-primary/5' : 'border-muted'}`}
                                    onClick={() => setResponseStrategy('mock')}
                                >
                                    <Bot className="h-8 w-8 mb-2 text-purple-500" />
                                    <div className="text-center">
                                        <div className="font-bold">Mock Response</div>
                                        <div className="text-xs text-muted-foreground">Return a custom mock</div>
                                    </div>
                                    {responseStrategy === 'mock' && <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-primary" />}
                                </div>
                            </div>

                            {/* Specific Target Dropdown */}
                            {responseStrategy === 'specific' && (
                                <div className="grid gap-2">
                                    <Label>Select Target</Label>
                                    <Select value={responseTargetId} onValueChange={setResponseTargetId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a target" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {targets.map(target => (
                                                <SelectItem key={target.id} value={target.id}>
                                                    {target.nickname} ({target.baseUrl})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Mock Response Editor */}
                            {responseStrategy === 'mock' && (
                                <div className="grid gap-4">
                                    <div className="grid gap-2">
                                        <Label>Mock Response (JSON)</Label>
                                        <div className="border rounded-md overflow-hidden">
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
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                        <div className="space-y-0.5">
                                            <Label className="text-base">Force Mode</Label>
                                            <p className="text-xs text-muted-foreground">
                                                {responseMockForce
                                                    ? "Always return mock response regardless of target status"
                                                    : "Return mock only if targets succeed, else return last target response"
                                                }
                                            </p>
                                        </div>
                                        <Switch
                                            checked={responseMockForce}
                                            onCheckedChange={setResponseMockForce}
                                        />
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    )}
                </Card>

                {/* Code Editor */}
                <Card className="flex-1 flex flex-col min-h-[500px]">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileCode className="h-5 w-5" /> Transformation Code
                        </CardTitle>
                        <CardDescription>{scriptName || 'untitled'}.js</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 overflow-hidden rounded-b-lg">
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
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default ScriptEditor;

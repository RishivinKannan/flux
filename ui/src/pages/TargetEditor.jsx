import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, ArrowLeft, Info, CheckCircle2 } from "lucide-react";

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
    if (saving) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    if (!nickname.trim() || !baseUrl.trim()) {
      setError('Nickname and Base URL are required');
      setSaving(false);
      return;
    }

    const tagsArray = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);

    let metadata = {};
    try {
      metadata = JSON.parse(metadataJson);
    } catch (err) {
      setError('Invalid JSON in metadata field');
      setSaving(false);
      return;
    }

    try {
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
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEditMode ? `Edit: ${nickname}` : 'Add New Target'}
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure proxy target with custom metadata
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/targets')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Target
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
        <Card>
          <CardHeader>
            <CardTitle>Target Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="nickname">Nickname <span className="text-destructive">*</span></Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Production API"
              />
              <p className="text-xs text-muted-foreground">Friendly name for this target</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="baseUrl">Base URL <span className="text-destructive">*</span></Label>
              <Input
                id="baseUrl"
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com"
              />
              <p className="text-xs text-muted-foreground">Full base URL including protocol</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="production, api, v2"
              />
              <p className="text-xs text-muted-foreground">Comma-separated tags to control which scripts run for this target</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="metadata">Metadata (JSON)</Label>
              <Textarea
                id="metadata"
                value={metadataJson}
                onChange={(e) => setMetadataJson(e.target.value)}
                rows={10}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Custom metadata accessible in transformation scripts</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4" /> Using Metadata in Transformations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              The metadata is passed as a second parameter to transformation functions:
            </p>
            <div className="bg-background border rounded-md p-4 overflow-x-auto">
              <pre className="text-xs font-mono language-javascript">
                {`export default {
  transformHeaders: (headers, metadata) => ({
    ...headers,
    'Authorization': \`Bearer \${metadata.licenseKey}\`
  }),
  
  transformBody: (body, metadata) => ({
    ...body,
    apiKey: metadata.licenseKey,
    env: metadata.environment
  })
};`}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default TargetEditor;

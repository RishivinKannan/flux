import React, { useState, useRef } from 'react';
import api from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Download, Upload, CheckCircle2, AlertCircle, FileJson, Loader2, ArrowDownUp } from "lucide-react";

function DataTransfer() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [importMode, setImportMode] = useState('merge');
    const [importPreview, setImportPreview] = useState(null);
    const fileInputRef = useRef(null);

    const handleExport = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const data = await api.exportData();

            // Create and download JSON file
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const date = new Date().toISOString().split('T')[0];
            a.href = url;
            a.download = `flux-export-${date}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setSuccess(`Exported ${data.data.scripts.length} scripts, ${data.data.targets.length} targets, and ${Object.keys(data.data.config).length} config items.`);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (!data.data || !data.version) {
                    throw new Error('Invalid export file format');
                }
                setImportPreview(data);
                setError(null);
            } catch (err) {
                setError('Failed to parse file: ' + err.message);
                setImportPreview(null);
            }
        };
        reader.readAsText(file);
    };

    const handleImport = async () => {
        if (!importPreview) return;

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const result = await api.importData(importPreview.data, importMode);

            const { scripts, targets, config } = result.results;
            setSuccess(
                `Import complete! ` +
                `Scripts: ${scripts.imported} imported, ${scripts.skipped} skipped. ` +
                `Targets: ${targets.imported} imported, ${targets.skipped} skipped. ` +
                `Config: ${config.imported} imported, ${config.skipped} skipped.`
            );
            setImportPreview(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const clearImport = () => {
        setImportPreview(null);
        setError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="container mx-auto py-6 max-w-3xl">
            <div className="flex items-center gap-3 mb-8">
                <ArrowDownUp className="h-8 w-8 text-primary" />
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Data Transfer</h1>
                    <p className="text-muted-foreground mt-1">
                        Export and import scripts, targets, and configuration
                    </p>
                </div>
            </div>

            {error && (
                <Alert variant="destructive" className="mb-6">
                    <AlertCircle className="h-4 w-4" />
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
                {/* Export Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Download className="h-5 w-5" />
                            Export Data
                        </CardTitle>
                        <CardDescription>
                            Download all scripts, targets, and configuration as a JSON file
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={handleExport} disabled={loading} size="lg">
                            {loading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Download className="mr-2 h-4 w-4" />
                            )}
                            Export All Data
                        </Button>
                    </CardContent>
                </Card>

                {/* Import Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Upload className="h-5 w-5" />
                            Import Data
                        </CardTitle>
                        <CardDescription>
                            Upload a previously exported JSON file to restore data
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6">
                        {/* File Upload */}
                        <div className="grid gap-2">
                            <Label htmlFor="importFile">Select Export File</Label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                id="importFile"
                                accept=".json,application/json"
                                onChange={handleFileSelect}
                                className="block w-full text-sm text-muted-foreground
                                    file:mr-4 file:py-2 file:px-4
                                    file:rounded-md file:border-0
                                    file:text-sm file:font-semibold
                                    file:bg-primary file:text-primary-foreground
                                    hover:file:bg-primary/90
                                    cursor-pointer"
                            />
                        </div>

                        {/* Import Mode */}
                        <div className="grid gap-3">
                            <Label>Import Mode</Label>
                            <div className="grid grid-cols-2 gap-3">
                                <div
                                    onClick={() => setImportMode('merge')}
                                    className={`relative flex flex-col items-center justify-center rounded-md border-2 p-4 cursor-pointer transition-all ${importMode === 'merge' ? 'border-primary bg-primary/5' : 'border-muted hover:bg-muted/50'
                                        }`}
                                >
                                    <div className="font-bold mb-1">Merge</div>
                                    <div className="text-xs text-muted-foreground text-center">
                                        Add new items, skip existing ones
                                    </div>
                                    {importMode === 'merge' && (
                                        <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-primary" />
                                    )}
                                </div>
                                <div
                                    onClick={() => setImportMode('replace')}
                                    className={`relative flex flex-col items-center justify-center rounded-md border-2 p-4 cursor-pointer transition-all ${importMode === 'replace' ? 'border-primary bg-primary/5' : 'border-muted hover:bg-muted/50'
                                        }`}
                                >
                                    <div className="font-bold mb-1">Replace</div>
                                    <div className="text-xs text-muted-foreground text-center">
                                        Overwrite existing items with imported data
                                    </div>
                                    {importMode === 'replace' && (
                                        <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-primary" />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Preview */}
                        {importPreview && (
                            <div className="rounded-md border p-4 bg-muted/30">
                                <div className="flex items-center gap-2 mb-3">
                                    <FileJson className="h-5 w-5 text-primary" />
                                    <span className="font-semibold">Import Preview</span>
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div className="text-center p-3 rounded-md bg-background">
                                        <div className="text-2xl font-bold text-primary">
                                            {importPreview.data.scripts?.length || 0}
                                        </div>
                                        <div className="text-muted-foreground">Scripts</div>
                                    </div>
                                    <div className="text-center p-3 rounded-md bg-background">
                                        <div className="text-2xl font-bold text-primary">
                                            {importPreview.data.targets?.length || 0}
                                        </div>
                                        <div className="text-muted-foreground">Targets</div>
                                    </div>
                                    <div className="text-center p-3 rounded-md bg-background">
                                        <div className="text-2xl font-bold text-primary">
                                            {Object.keys(importPreview.data.config || {}).length}
                                        </div>
                                        <div className="text-muted-foreground">Config Items</div>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-3">
                                    Exported: {new Date(importPreview.exportedAt).toLocaleString()} • Version: {importPreview.version}
                                </p>
                            </div>
                        )}

                        {/* Import Actions */}
                        <div className="flex gap-3">
                            <Button
                                onClick={handleImport}
                                disabled={!importPreview || loading}
                                size="lg"
                            >
                                {loading ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Upload className="mr-2 h-4 w-4" />
                                )}
                                Import Data
                            </Button>
                            {importPreview && (
                                <Button variant="outline" onClick={clearImport}>
                                    Clear
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default DataTransfer;

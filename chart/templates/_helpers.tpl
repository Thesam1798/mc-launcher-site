{{- define "mc-launcher-site.name" -}}
mc-launcher-site
{{- end }}

{{- define "mc-launcher-site.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/part-of: mc-launcher
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}

{{- define "mc-launcher-site.selectorLabels" -}}
app.kubernetes.io/name: mc-launcher-site
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

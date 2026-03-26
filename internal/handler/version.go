package handler

import (
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

// BuildVersion and BuildCommit are set at build time via -ldflags.
// Fallback: read VERSION file (local dev) or "dev".
var (
	BuildVersion string
	BuildCommit  string
)

var (
	appVersion   string
	appCommit    string
	appBuildTime = time.Now().UTC().Format(time.RFC3339)
	startTime    = time.Now()
)

func init() {
	if BuildVersion != "" {
		appVersion = BuildVersion
	} else if data, err := os.ReadFile("VERSION"); err == nil {
		appVersion = strings.TrimSpace(string(data))
	} else {
		appVersion = "dev"
	}

	if BuildCommit != "" {
		appCommit = BuildCommit
	} else if out, err := exec.Command("git", "rev-parse", "--short", "HEAD").Output(); err == nil {
		appCommit = strings.TrimSpace(string(out))
	}
}

type versionResponse struct {
	Version   string `json:"version"`
	Commit    string `json:"commit,omitempty"`
	BuildTime string `json:"build_time"`
	GoVersion string `json:"go_version"`
	Uptime    string `json:"uptime"`
}

func (h *Handler) GetVersion(w http.ResponseWriter, r *http.Request) {
	ok(w, versionResponse{
		Version:   appVersion,
		Commit:    appCommit,
		BuildTime: appBuildTime,
		GoVersion: runtime.Version(),
		Uptime:    time.Since(startTime).Truncate(time.Second).String(),
	})
}

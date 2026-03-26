package handler

import (
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

var (
	appVersion   string
	appCommit    string
	appBuildTime = time.Now().UTC().Format(time.RFC3339)
)

func init() {
	if data, err := os.ReadFile("VERSION"); err == nil {
		appVersion = strings.TrimSpace(string(data))
	} else {
		appVersion = "dev"
	}

	if out, err := exec.Command("git", "rev-parse", "--short", "HEAD").Output(); err == nil {
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

var startTime = time.Now()

func (h *Handler) GetVersion(w http.ResponseWriter, r *http.Request) {
	uptime := time.Since(startTime).Truncate(time.Second).String()

	ok(w, versionResponse{
		Version:   appVersion,
		Commit:    appCommit,
		BuildTime: appBuildTime,
		GoVersion: runtime.Version(),
		Uptime:    uptime,
	})
}

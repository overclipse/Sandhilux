package handler

import (
	"fmt"
	"net"
	"net/url"
	"strings"
)

// privateRanges contains all IP ranges that must never be reached by user-supplied URLs.
// Prevents SSRF attacks targeting internal services, cloud metadata endpoints, etc.
var privateRanges []*net.IPNet

func init() {
	for _, cidr := range []string{
		"127.0.0.0/8",   // loopback
		"10.0.0.0/8",    // RFC1918 private
		"172.16.0.0/12", // RFC1918 private
		"192.168.0.0/16", // RFC1918 private
		"169.254.0.0/16", // link-local (AWS metadata: 169.254.169.254)
		"100.64.0.0/10",  // shared address space (RFC6598)
		"0.0.0.0/8",      // "this" network
		"::1/128",         // IPv6 loopback
		"fc00::/7",        // IPv6 unique local
		"fe80::/10",       // IPv6 link-local
	} {
		_, ipNet, err := net.ParseCIDR(cidr)
		if err == nil {
			privateRanges = append(privateRanges, ipNet)
		}
	}
}

func isPrivateIP(ip net.IP) bool {
	for _, r := range privateRanges {
		if r.Contains(ip) {
			return true
		}
	}
	return false
}

// validateEndpointURL checks that rawURL:
//  1. Parses as a valid URL
//  2. Uses http or https scheme
//  3. Has a non-empty hostname
//  4. Does not target localhost or known private/reserved IP ranges (SSRF prevention)
//
// DNS resolution is attempted; if all resolved IPs are private the URL is rejected.
// If DNS fails entirely the URL is allowed — the probe will fail naturally.
func validateEndpointURL(rawURL string) error {
	u, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("URL scheme must be http or https, got %q", u.Scheme)
	}

	host := u.Hostname()
	if host == "" {
		return fmt.Errorf("URL must have a hostname")
	}

	// Block localhost by name (case-insensitive, including sub-domains).
	lower := strings.ToLower(host)
	if lower == "localhost" || strings.HasSuffix(lower, ".localhost") {
		return fmt.Errorf("URL must not target localhost")
	}

	// If host is a literal IP address, check directly.
	if ip := net.ParseIP(host); ip != nil {
		if isPrivateIP(ip) {
			return fmt.Errorf("URL must not target a private or reserved IP address")
		}
		return nil
	}

	// For hostnames: resolve and reject if any resolved IP is private.
	addrs, err := net.LookupHost(host)
	if err != nil {
		// DNS failure is not our concern here — let the probe fail.
		return nil
	}
	for _, addr := range addrs {
		if ip := net.ParseIP(addr); ip != nil && isPrivateIP(ip) {
			return fmt.Errorf("URL hostname %q resolves to a private IP address", host)
		}
	}
	return nil
}

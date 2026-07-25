// Minimal News Radar–style client: fetch Spring Cloud Config Environment over HTTP
// and print aiplane.prompts.* keys. Stdlib only — no Config SDK.
//
// Usage:
//
//	go run . -url http://localhost:8888 -app news-radar -profile default
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"
)

// environment is the Spring Cloud Config Server Environment response (subset).
type environment struct {
	Name            string           `json:"name"`
	Profiles        []string         `json:"profiles"`
	Label           string           `json:"label"`
	PropertySources []propertySource `json:"propertySources"`
}

type propertySource struct {
	Name   string                 `json:"name"`
	Source map[string]interface{} `json:"source"`
}

func main() {
	baseURL := flag.String("url", "http://localhost:8888", "Config Server base URL")
	app := flag.String("app", "news-radar", "application name (AIPlane project slug)")
	profile := flag.String("profile", "default", "Spring profile")
	label := flag.String("label", "", "optional label (empty = server default, usually main)")
	flag.Parse()

	path := fmt.Sprintf("%s/%s/%s", strings.TrimRight(*baseURL, "/"), *app, *profile)
	if *label != "" {
		path += "/" + *label
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(path)
	if err != nil {
		fmt.Fprintf(os.Stderr, "GET %s: %v\n", path, err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Fprintf(os.Stderr, "read body: %v\n", err)
		os.Exit(1)
	}
	if resp.StatusCode != http.StatusOK {
		fmt.Fprintf(os.Stderr, "GET %s → %s\n%s\n", path, resp.Status, body)
		os.Exit(1)
	}

	var env environment
	if err := json.Unmarshal(body, &env); err != nil {
		fmt.Fprintf(os.Stderr, "decode Environment JSON: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("application=%s profiles=%v label=%s\n", env.Name, env.Profiles, env.Label)
	fmt.Printf("propertySources=%d\n", len(env.PropertySources))

	keys := collectPromptKeys(env)
	if len(keys) == 0 {
		fmt.Println("no aiplane.prompts.* keys found — promote an active version first?")
		os.Exit(0)
	}

	fmt.Println("aiplane.prompts.* keys:")
	for _, k := range keys {
		fmt.Printf("  %s = %s\n", k, lookup(env, k))
	}
}

func collectPromptKeys(env environment) []string {
	seen := map[string]struct{}{}
	var keys []string
	for _, ps := range env.PropertySources {
		for k := range ps.Source {
			if strings.HasPrefix(k, "aiplane.prompts.") {
				if _, ok := seen[k]; !ok {
					seen[k] = struct{}{}
					keys = append(keys, k)
				}
			}
		}
	}
	sort.Strings(keys)
	return keys
}

func lookup(env environment, key string) string {
	// Later propertySources override earlier ones (Spring Cloud Config order).
	for i := len(env.PropertySources) - 1; i >= 0; i-- {
		if v, ok := env.PropertySources[i].Source[key]; ok {
			return fmt.Sprint(v)
		}
	}
	return ""
}

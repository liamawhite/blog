package main

import (
	"bytes"
	"flag"
	"fmt"
	"io/ioutil"
	"path/filepath"
	"regexp"
	"strings"
)

var (
	papersSrc = "literature/papers"
	papersDst = "content/literature-notes"

	imagesSrc        = "_meta/assets"
	imagesDst        = "static"
	imageLinkRegex   = regexp.MustCompile(`!\[\[(.*)\]\]`)
	imageLinkReplace = "![](/$1)"

	formatSuffixes = []string{" (paper)"}
)

func main() {
	pkmPtr := flag.String("pkm", "../pkm", "source pkm directory root")
	copyFiles(filepath.Join(*pkmPtr, imagesSrc), imagesDst)
	copyFiles(filepath.Join(*pkmPtr, papersSrc), papersDst, addPaperType)
}

// Also sanitizes names and fixes any image links
func copyFiles(srcDir, dstDir string, otherMutators ...func([]byte) []byte) {
	files, err := ioutil.ReadDir(srcDir)
	if err != nil {
		panic(err)
	}
	for _, file := range files {
		contents, err := ioutil.ReadFile(filepath.Join(srcDir, file.Name()))
		if err != nil {
			panic(err)
		}
		contents = imageLinkRegex.ReplaceAll(contents, []byte(imageLinkReplace))
		for _, mutator := range otherMutators {
			contents = mutator(contents)
		}
		dstPath := filepath.Join(dstDir, sanitizeFilename(file.Name()))
		if err := ioutil.WriteFile(dstPath, contents, 0644); err != nil {
			panic(err)
		}
	}
}

var addPaperType = func(contents []byte) []byte {
	return prependType("paper", contents)
}

func prependType(t string, contents []byte) []byte {
	return bytes.Replace(contents, []byte("---"), []byte(fmt.Sprintf("---\ntype: %v", t)), 1)
}

func sanitizeFilename(s string) string {
	s = strings.ToLower(s)
	for _, suffix := range formatSuffixes {
		s = strings.ReplaceAll(s, suffix, "")
	}
	s = strings.ReplaceAll(s, " ", "-")
	return s
}

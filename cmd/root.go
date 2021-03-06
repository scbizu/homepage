// Copyright © 2018 NAME HERE scbizu@gmail.com
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package cmd

import (
	"fmt"
	"net/http"
	"os"

	"github.com/spf13/cobra"
)

var staticFilePath string

// RootCmd represents the base command when called without any subcommands
var RootCmd = &cobra.Command{
	Use:   "homepage",
	Short: "The homepage of scnace",
	Long: `The homepage of scnace:
	* homepage will use GopherJS as the front-end
	* homepage is the index of scnace
	`,
	Run: func(cmd *cobra.Command, args []string) {
		port := os.Getenv("PORT")
		if err := http.ListenAndServe(fmt.Sprintf(":%s", port), http.FileServer(http.Dir(staticFilePath))); err != nil {
			panic(err)
		}
	},
}

// Execute adds all child commands to the root command sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	if err := RootCmd.Execute(); err != nil {
		panic(err)
	}
}

func init() {
	// Here you will define your flags and configuration settings.
	// Cobra supports Persistent Flags, which, if defined here,
	// will be global for your application.
	RootCmd.PersistentFlags().StringVarP(&staticFilePath, "static", "s", "static", "set static file path(default is static folder)")
}

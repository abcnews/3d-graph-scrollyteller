require("colors");
const path = require("path");

/**
 * @license
 * Copyright Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// [START sheets_quickstart]
const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");

// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(__dirname, ".token.json");

// Load client secrets from a local file.
fs.readFile(path.join(__dirname, ".credentials.json"), (err, content) => {
  if (err) return console.error("Error loading client secret file:", err);
  // Authorize a client with credentials, then call the Google Sheets API.
  authorize(JSON.parse(content), listMajors);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES
  });
  console.error("Authorize this app by visiting this url:", authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question("Enter the code from that page here: ", code => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err)
        return console.error(
          "Error while trying to retrieve access token",
          err
        );
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), err => {
        if (err) return console.error(err);
        console.error("Token stored to", TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

/**
 * Prints the names and majors of students in a sample spreadsheet:
 * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
function listMajors(auth) {
  Promise.all([
    getRange(auth, "Nodes"),
    getRange(auth, "Edges"),
    getRange(auth, "Groups")
  ]).then(([nodes, edges, groups]) => {
    // Just the fields we want
    edges = edges
      .slice(1)
      .filter(e => e[7] && e[7].trim().toUpperCase() === "X")
      .map(e => [e[0], e[1], e[2], e[3]]);
    nodes = nodes.slice(1).map(n => [n[0], n[1]]);
    groups = groups.slice(1).map(g => [g[0].trim().toLowerCase(), g[1] || ""]);

    // Some sanity checking

    const unique = (v, i, a) => a.indexOf(v) === i;

    // Do all the names in edges exist in nodes?
    const nodeNames = nodes.map(n => n[0]).filter(unique);
    const edgeNames = edges
      .reduce((names, e) => {
        return names.concat(e.slice(0, 2));
      }, [])
      .filter(unique);
    const unconnectedNodes = nodeNames.filter(x => !edgeNames.includes(x));
    const missingNodes = edgeNames.filter(x => !nodeNames.includes(x));
    if (unconnectedNodes.length) {
      console.error(
        `${"Unconnected nodes:".bold} ${unconnectedNodes.join(", ")}`
      );
    }
    if (missingNodes.length) {
      console.error(`${"Missing nodes:".red.bold} ${missingNodes.join(", ")}`);
    }

    // Check for duplicate group names
    const count = arr =>
      arr.reduce((a, b) => ({ ...a, [b]: (a[b] || 0) + 1 }), {}); // don't forget to initialize the accumulator
    const duplicates = dict => Object.keys(dict).filter(a => dict[a] > 1);
    const groupNameDuplicates = duplicates(count(groups.map(g => g[0])));

    if (groupNameDuplicates.length > 0) {
      console.error(
        `${"Duplicate group names exist:".red.bold} ${groupNameDuplicates.join(
          ", "
        )}`
      );
    }

    // Are there any group names that don't exist in nodes?
    const groupNames = groups
      .reduce((names, group) => {
        if (!group[1]) return names;
        return names.concat(group[1].split(",").map(n => n.trim()));
      }, [])
      .filter(unique);
    const missingGroupNodes = groupNames.filter(x => !nodeNames.includes(x));
    if (missingGroupNodes.length) {
      console.error(
        `${
          "Groups include nodes that don't exist:".red.bold
        } ${missingGroupNodes.join(", ")}`
      );
    }

    // TODO: Make sure no edges link the same node

    // TODO: Remove disconnected nodes

    // Re-index
    const data = {
      nodes: nodes.map(n => n[0]),
      edges: edges.map(e => [
        nodes.map(n => n[0]).indexOf(e[0]),
        nodes.map(n => n[0]).indexOf(e[1])
      ]),
      groups: groups.map(group => {
        return [
          group[0],
          group[1].split(",").map(n => nodes.map(n => n[0]).indexOf(n.trim()))
        ];
      })
    };

    console.error();
    console.error(
      "The following output needs to be copied and pasted into CM.\nYou can also pipe this data some place if you want."
    );
    console.error();
    console.error("data.json".bold.underline);
    console.error();
    console.log(JSON.stringify(data));
  });
}

function getRange(auth, range) {
  return new Promise((resolve, reject) => {
    const sheets = google.sheets({ version: "v4", auth });
    sheets.spreadsheets.values.get(
      {
        spreadsheetId: process.env.SHEET_ID,
        range
      },
      (err, res) => {
        if (err) return reject(err);
        resolve(res.data.values);
      }
    );
  });
}

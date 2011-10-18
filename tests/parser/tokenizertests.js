load("dom.js");

var numtests = 0;
var numpassed = 0;
var numaborted = 0;
var failures = [];
var testfile;

arguments.forEach(runTestFile);
report();

// Run the tests in a single named file
function runTestFile(filename) {
    testfile = filename;
    putstr(filename);
    var testsobj = JSON.parse(snarf(filename));
    var tests = testsobj.tests;
    if (tests) {
        tests.forEach(function(t, n) {
            test(t, n, false);
        });
    }
    else {
        print("ERROR: couldn't parse tests from", filename);
        print();
        return;
    }

    // Read the file and run the tests again, but feed the scanner
    // one character at a time rather than full string at a time
    var testsobj = JSON.parse(snarf(filename));
    var tests = testsobj.tests;
    if (tests) {
        tests.forEach(function(t, n) {
            test(t, n, true);
        });
    }

    print();
}

function test(t, n, charbychar) {
    var input = t.input;
    var states = t.initialStates || ["PCDATA state"];
    var lasttag = t.lastStartTag;

    // If the input is has double escaped characters, fix them
    if (t.doubleEscaped) {
        input = input.replace(/\\u(....)/, function(s, digits) {
            return String.fromCharCode(parseInt(digits, 16))
        });
    }

    // Remove parse errors from the expected output, since our parser
    // doesn't track them.  Then, coalesce newly adjacent text tokens.
    var firstpass = t.output.filter(function(x){ return x !== "ParseError"});
    var expected = [];
    for(var i = 0; i < firstpass.length; i++) {
        var token = firstpass[i];
        if (i > 0 &&
            token[0] === "Character" &&
            expected[expected.length-1][0] === "Character") {
            expected[expected.length-1][1] += token[1];
        }
        else {
            expected.push(token);
        }
    }

    expected = JSON.stringify(expected);
    if (t.doubleEscaped) {
        expected = expected.replace(/\\u(....)/, function(s, digits) {
            return String.fromCharCode(parseInt(digits, 16))
        });
    }
    
    // Run the test once for each initial state 
    for(var s = 0; s < states.length; s++) {
        try {
            numtests++;
            var initialState = states[s];
            var parser = HTMLParser();
            var output = JSON.stringify(parser.testTokenizer(input,
                                                             initialState,
                                                             lasttag,
                                                             charbychar));
            
            if (output === expected) {
                numpassed++;
            }
            else {
                failures.push({
                    filename: testfile,
                    testnum: n,
                    description: t.description,
                    state: initialState,
                    charbychar: charbychar,
                    input: input,
                    output: output,
                    expected: expected
                });
            }
        }
        catch(e) {
            numaborted++;
            failures.push({
                filename: testfile,
                testnum: n,
                description: t.description,
                state: initialState,
                charbychar: charbychar,
                input: input,
                exception: e
            });
        }
    }
}

function report() {
    function print() {
        for(var i = 0; i < arguments.length; i++) {
            if (i > 0) putstr(" ");
            var s = String(arguments[i]);
            for(var j = 0; j < s.length; j++) {
                var c = s[j];
                var codepoint = s.charCodeAt(j);
                if (codepoint >= 0x20 && codepoint < 0x7f || codepoint === 0xa) {
                    putstr(c);
                }
                else {
                    putstr("\\");
                    var cp = codepoint.toString(16);
                    if (cp.length == 1) cp = "0" + cp;
                    if (cp.length == 2) putstr("x");
                    else putstr("u");
                    if (cp.length == 3) cp = "0" + cp;
                    for(var k = 0; k < cp.length; k++) putstr(cp[k]);
                }
            }
        }
        putstr("\n");
    }

    if (numpassed === numtests) {
        print("All", numtests, "tests passed.");
    }
    else {
        print(numpassed, "passed.");
        print(numtests - numpassed - numaborted, "failed.");
        print(numaborted, "aborted.");

        // Print the aborts first
        failures.forEach(function(f) {
            if (f.exception) {
                print("----------");
                print(f.filename, "test #" + f.testnum + ": " + f.description);
                print("Input:", f.input);
                print("Initial state: ", f.state);
                if (f.charbychar)
                    print("One character at a time");
                print("Aborted with:",
                      f.exception.name + ": " + f.exception.message,
                      "at", f.exception.fileName + ":" +f.exception.lineNumber);
                print(f.exception.stack.split("\n").slice(1,5).join("\n"));
                print();
            }
        });


        // Then print the failures
        failures.forEach(function(f) {
            if (f.exception) return;
            print("----------");
            print(f.filename, "test #" + f.testnum + ": " + f.description);
            print("Input:", f.input);
            print("Initial state: ", f.state);
            if (f.charbychar)
                print("One character at a time");
            print("Got:");
            print(f.output);
            print("Expected:");
            print(f.expected);
            print();
        });
    }
}
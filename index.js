/// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
/// @Copyright ~2015 Samlv9 and other contributors.
/// @MIT-LICENSE | dev-1.0.0 | http://samlv9.com/
/// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
///                                              }|
///                                              }|
///                                              }|     　 へ　　　 ／|    
///      _______     _______         ______      }|      /　│　　 ／ ／
///     /  ___  |   |_   __ \      .' ____ '.    }|     │　Z ＿,＜　／　　 /`ヽ
///    |  (__ \_|     | |__) |     | (____) |    }|     │　　　　　ヽ　　 /　　〉
///     '.___`-.      |  __ /      '_.____. |    }|      Y　　　　　`　 /　　/
///    |`\____) |    _| |  \ \_    | \____| |    }|    ｲ●　､　●　　⊂⊃〈　　/
///    |_______.'   |____| |___|    \______,'    }|    ()　 v　　　　|　＼〈
///    |=========================================\|    　>ｰ ､_　 ィ　 │ ／／
///    | LESS IS MORE!                           ||     / へ　　 /　ﾉ＜|＼＼
///    `=========================================/|    ヽ_ﾉ　　(_／　 │／／
///                                              }|     7　　　　　　  |／
///                                              }|     ＞―r￣￣`ｰ―＿`
///                                              }|
///                                              }|
/// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
/// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
/// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
/// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
/// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
/// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
/// THE SOFTWARE.

var fs       = require("fs");
var path     = require("path");
var through  = require("through2");
var crypto   = require("crypto");
var isUtf8   = require("isutf8");
var File     = require("vinyl");
var Concat   = require("concat-with-sourcemaps");
var STAT_BUFFER = {};
var DATA_BUFFER = {};
var TIME_BUFFER = {};
var DATA_DEPENC = {};
var TIME_DEPENC = {};
var LINE_APPDIX = "\n";


function transform( file, encoding, callback ) {
    if ( file.isNull() ) {
        return callback(null, file);
    }

    if ( file.isStream() ) {
        return callback(new Error("gulp-reference: streaming not supported"));
    }

    if ( file.isBuffer ) {
        STAT_BUFFER = {};
        file = traversal(file);
    }

    return callback(null, file);
}


function traversal( root ) {
    var flags = {};
    var visit = {};
    var store = [];
    var stack = [root];
    var file  = null;
    var name  = null;

    while( (file = stack.pop()) && (name = file.path) ) {
        if ( flags[name] ) { 
            flags[name] = false; 
            store[store.length] = file; 
            continue;
        }

        if ( !visit[name] ) { 
            visit[name] = true;
            flags[name] = true;
            stack = stack.concat(file, getDependencies(file).reverse());
        }
    }

    return merge(root, store);
}


function merge( root, fileList ) {
    var fileConcat = new Concat(!!root.sourceMap, path.basename(root.path), LINE_APPDIX);
    var fileResult = new File({ path: root.path, base: root.base });

    for ( var i = 0; i < fileList.length; ++i ) {
        fileConcat.add(path.relative(root.base, fileList[i].path), fileList[i].contents, fileList[i].sourceMap);
    }

    if ( !!root.sourceMap ) {
        fileResult.contents  = fileConcat.content;
        fileResult.sourceMap = JSON.parse(fileConcat.sourceMap);
    }

    else {
        fileResult.contents  = fileConcat.content;
    }

    return fileResult;
}


function getDependencies( file ) {
    var time = +(fs.statSync(file.path).mtime);
    var list = [];

    if ( DATA_DEPENC[file.path] && time <= TIME_DEPENC[file.path] ) {
        list = DATA_DEPENC[file.path];
    }

    else {
        var comments = getComments(String(file.contents));
        var rRegexp  = /<\/?reference((\s+\w+(\s*=\s*(?:".*?"|'.*?'|[^'">\s]+))?)+\s*|\s*)\/?>/g;
        var pRegexp  = /path\s*=\s*(?:"(.*?)"|'(.*?)')/;
        var result   = null;

        while( (result = rRegexp.exec(comments)) ) {
            result = result[1] && pRegexp.exec(result[1]);
            result = result && (result[1] || result[2]);
            result && list.push(path.join(path.dirname(file.path), result.trim())); 
        }

        TIME_DEPENC[file.path] = time;
        DATA_DEPENC[file.path] = list;
    }

    for ( var i = 0, fileList = []; i < list.length; ++i ) {
        fileList[i] = new File({ path: list[i], base: file.base, contents: getContents(list[i]) });
    }

    return fileList;
}


function getContents( path ) {
    if ( STAT_BUFFER[path] ) {
        return DATA_BUFFER[path]; 
    }

    var time = +(fs.statSync(path).mtime);

    if ( DATA_BUFFER[path] && time <= TIME_BUFFER[path] ) {
        STAT_BUFFER[path] = true;
        return DATA_BUFFER[path];
    }

    var data = fs.readFileSync(path);

    if ( isUtf8(data) 
        && (data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) ) { // utf-8 bom

        STAT_BUFFER[path] = true;
        TIME_BUFFER[path] = time;
        DATA_BUFFER[path] = data.slice(3);
    }

    else {
        STAT_BUFFER[path] = true;
        TIME_BUFFER[path] = time;
        DATA_BUFFER[path] = data;
    }

    return DATA_BUFFER[path];
}


function getComments( content ) {
    var start = content.charCodeAt(0) == 0xFEFF ? 1 : 0; // utf-8 bom
    
    for ( var i = start, k = 0, b = 0; i < content.length; ++i ) {
        k = content.charCodeAt(i);

        if ( k == 47 ) { // '/'
            if ( b == 0 ) { b = 1; continue; }
            if ( b == 1 ) { b = 2; continue; }
            if ( b == 4 ) { b = 0; continue; }
        }

        if ( k == 42 ) { // '*'
            if ( b == 1 ) { b = 3; continue; }
            if ( b == 3 || b == 4 ) { b = 4; continue; }
        }

        if ( b == 2 ) {
            if ( k == 10 ) { b = 0; }
            continue;
        }

        if ( b == 3 || b == 4 ) {
            b = 3;
            continue;
        }

        if ( k == 32 || k == 9 || k == 10 || k == 11 || k == 12 || k == 13 ) { // '\x20\t\n\v\f\r'
            continue;
        }

        break;
    }

    return content.slice(0, i);
}


module.exports = function() {
    return through.obj(transform);
}
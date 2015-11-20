# gulp-reference
基于 Visual Studio 的 <reference> 标记合并依赖项。<br>
concat your javascript modules together by use visual studio [`reference`](https://msdn.microsoft.com/en-us/library/bb385682(v=vs.110).aspx) tag.


####`main.js`:
```javascript
/// <reference path='module.js' />
var defineMain = true;
```
####`module.js`:
```javascript
var defineModule = true;
```
####`gulpfile.js`
```javascript
var gulp = require("gulp");
var reference = require("gulp-reference");

gulp.task("build", function () {
    gulp.src("main.js")
        .pipe(reference())
        .pipe(gulp.dest("output.js"));
}
```
####`module.js`+`main.js`=`output.js`
```javascript
var defineModule = true;
var defineMain = true;
```



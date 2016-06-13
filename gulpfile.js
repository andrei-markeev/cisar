var path = require('path');
var gulp = require('gulp');
var concat = require('gulp-concat');

gulp.task('watch', function () {
    gulp.watch('Scripts/typings/*/*.ts', ['create-libs-d-ts']);
});

/**
 * Compile app javascript / clean
 */
gulp.task('create-libs-d-ts', function () {
    return gulp.src([
            'Scripts/typings/lib.d.ts',
            'Scripts/typings/sharepoint/SharePoint.d.ts',
            'Scripts/typings/sharepoint/Search.ClientControls.d.ts',
            'Scripts/typings/jquery/jquery.d.ts',
            'Scripts/typings/knockout/knockout.d.ts'
        ])
        .pipe(concat('libs.d.ts'))
        .pipe(gulp.dest('Scripts/typings'));
});


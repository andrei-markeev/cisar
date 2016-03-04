module CSREditor {

    export class Utils {

        public static endsWith(s, suffix) {
            return s.indexOf(suffix, s.length - suffix.length) !== -1;
        }

        public static cutOffQueryString(s): string {
            if (s.indexOf('?') > 0)
                s = s.substr(0, s.indexOf('?'));
            return s;
        }
        public static toRelative(url: string, baseUrl: string) {
            url = url.toLowerCase().replace(baseUrl.toLowerCase(), '')
            url = Utils.cutOffQueryString(url.replace(' ', '%20'));
            if (url[0] != '/')
                url = '/' + url;
            return url;
        }

        public static safeEnterFileName(event, value, okCallback, cancelCallback) {
            return Utils.safeEnterValue(event, value, okCallback, cancelCallback, false);
        }
        public static safeEnterPath(event, value, okCallback, cancelCallback) {
            return Utils.safeEnterValue(event, value, okCallback, cancelCallback, true);
        }
        private static safeEnterValue(event, value, okCallback, cancelCallback, isPath: boolean) {
            if ((event.keyCode == 13 && value != "") || event.keyCode == 27) {

                if (event.keyCode == 13)
                    okCallback();
                else
                    cancelCallback();

                event.preventDefault();
                event.stopPropagation();
            }
            else {
                var safe = false;
                if (event.keyCode >= 65 && event.keyCode <= 90)
                    safe = true;
                if (event.keyCode >= 48 && event.keyCode <= 57 && event.shiftKey == false)
                    safe = true;
                if ([8, 35, 36, 37, 38, 39, 40, 46, 189].indexOf(event.keyCode) > -1)
                    safe = true;
                if (event.keyCode == 190 && event.shiftKey == false)
                    safe = true;
                if (event.char == "")
                    safe = true;
                if ([191, 32].indexOf(event.keyCode) > -1 && isPath)
                    safe = true;

                if (!safe) {
                    event.preventDefault();
                    event.stopPropagation();
                    return false;
                }
            }
            return true;
        }
    }

} 
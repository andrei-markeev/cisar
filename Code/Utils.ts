module CSREditor {

    export class Utils {

        public static endsWith(s, suffix) {
            return s.indexOf(suffix, s.length - suffix.length) !== -1;
        }

        public static cutOffQueryString(s) {
            if (s.indexOf('?') > 0)
                s = s.substr(0, s.indexOf('?'));
            return s;
        }

    }

} 
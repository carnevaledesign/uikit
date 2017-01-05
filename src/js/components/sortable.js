import { container, doc, mixin, util, win  } from 'uikit';

var {$, extend, isWithin, Observer, on, off, pointerDown, pointerMove, pointerUp, requestAnimationFrame} = util;

UIkit.component('sortable', {

    mixins: [mixin.class],

    props: {
        group: String,
        animation: Number,
        threshold: Number,
        clsItem: String,
        clsPlaceholder: String,
        clsDrag: String,
        clsDragState: String,
        clsBase: String,
        clsNoDrag: String,
        clsEmpty: String,
        clsCustom: String,
        handle: String
    },

    defaults: {
        group: false,
        animation: 150,
        threshold: 5,
        clsItem: 'uk-sortable-item',
        clsPlaceholder: 'uk-sortable-placeholder',
        clsDrag: 'uk-sortable-drag',
        clsDragState: 'uk-drag',
        clsBase: 'uk-sortable',
        clsNoDrag: 'uk-sortable-nodrag',
        clsEmpty: 'uk-sortable-empty',
        clsCustom: '',
        handle: false
    },

    ready() {

        ['init', 'start', 'move', 'end'].forEach(key => {
            let fn = this[key];
            this[key] = e => {
                e = e.originalEvent || e;
                this.scrollY = window.scrollY;
                var {pageX, pageY} = e.touches && e.touches[0] || e;
                this.pos = {x: pageX, y: pageY};

                fn(e);
            }
        });

        on(this.$el, pointerDown, this.init);

        if (this.clsEmpty) {
            var empty = () => this.$el.toggleClass(this.clsEmpty, !this.$el.children().length);
            (new Observer(empty)).observe(this.$el[0], {childList: true});
            empty();
        }

    },

    methods: {

        init(e) {

            var target = $(e.target), placeholder = this.$el.children().filter((i, el) => isWithin(e.target, el));

            if (!placeholder.length
                || target.is(':input')
                || this.handle && !isWithin(target, this.handle)
                || e.button && e.button !== 0
                || isWithin(target, `.${this.clsNoDrag}`)
            ) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            this.touched = [this];
            this.placeholder = placeholder;
            this.origin = extend({target, index: this.placeholder.index()}, this.pos);

            doc.on(pointerMove, this.move);
            doc.on(pointerUp, this.end);
            win.on('scroll', this.scroll);

            if (!this.threshold) {
                this.start(e);
            }

        },

        start(e) {

            this.drag = $(this.placeholder[0].outerHTML.replace(/^<li/i, '<div').replace(/li>$/i, 'div>'))
                .attr('uk-no-boot', '')
                .addClass(`${this.clsDrag} ${this.clsCustom}`)
                .css({
                    boxSizing: 'border-box',
                    width: this.placeholder.outerWidth(),
                    height: this.placeholder.outerHeight()
                })
                .css(this.placeholder.css(['paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom']))
                .appendTo(container);

            this.drag.children().first().height(this.placeholder.children().height());

            var {left, top} = this.placeholder.offset();
            extend(this.origin, {left: left - this.pos.x, top: top - this.pos.y});

            this.placeholder.addClass(this.clsPlaceholder);
            this.$el.children().addClass(this.clsItem);
            doc.addClass(this.clsDragState);

            this.$el.trigger('start', [this, this.placeholder, this.drag]);

            this.move(e);
        },

        move(e) {

            if (!this.drag) {

                if (Math.abs(this.pos.x - this.origin.x) > this.threshold || Math.abs(this.pos.y - this.origin.y) > this.threshold) {
                    this.start(e);
                }

                return;
            }

            this.update();

            var target = e.type === 'mousemove' ? e.target : document.elementFromPoint(this.pos.x - document.body.scrollLeft, this.pos.y - document.body.scrollTop),
                sortable = getSortable(target),
                previous = getSortable(this.placeholder[0]),
                move = sortable !== previous;

            if (!sortable || isWithin(target, this.placeholder) || move && (!sortable.group || sortable.group !== previous.group)) {
                return;
            }

            target = sortable.$el.is(target.parentNode) && $(target) || sortable.$el.children().has(target);

            if (move) {
                previous.remove(this.placeholder);
            } else if (!target.length) {
                return;
            }

            sortable.insert(this.placeholder, target);

            if (this.touched.indexOf(sortable) === -1) {
                this.touched.push(sortable);
            }

        },

        scroll() {
            var scroll = window.scrollY;
            if (scroll !== this.scrollY) {
                this.pos.y += scroll - this.scrollY;
                this.scrollY = scroll;
                this.update();
            }
        },

        end(e) {

            doc.off(pointerMove, this.move);
            doc.off(pointerUp, this.end);
            win.off('scroll', this.scroll);

            if (!this.drag) {

                if (e.type !== 'mouseup' && isWithin(e.target, 'a[href]')) {
                    location.href = $(e.target).closest('a[href]').attr('href');
                }

                return;
            }

            preventClick();

            var sortable = getSortable(this.placeholder[0]);

            if (this === sortable) {
                if (this.origin.index !== this.placeholder.index()) {
                    this.$el.trigger('change', [this, this.placeholder, 'moved']);
                }
            } else {
                sortable.$el.trigger('change', [sortable, this.placeholder, 'added']);
                this.$el.trigger('change', [this, this.placeholder, 'removed']);
            }

            this.$el.trigger('stop', [this]);

            this.drag.remove();
            this.drag = null;

            this.touched.forEach(sortable => sortable.$el.children().removeClass(`${sortable.clsPlaceholder} ${sortable.clsItem}`));

            doc.removeClass(this.clsDragState);

        },

        update() {

            if (!this.updating) {
                requestAnimationFrame(() => {

                    this.updating = false;

                    if (!this.drag) {
                        return;
                    }

                    this.drag.offset({top: this.pos.y + this.origin.top, left: this.pos.x + this.origin.left});

                    var top = this.drag.offset().top, bottom = top + this.drag[0].offsetHeight;

                    if (top > 0 && top < this.scrollY) {
                        setTimeout(() => win.scrollTop(this.scrollY - 5), 5);
                    } else if (bottom < doc[0].offsetHeight && bottom > window.innerHeight + this.scrollY) {
                        setTimeout(() => win.scrollTop(this.scrollY + 5), 5);
                    }

                })
            }

            this.updating = true;

        },

        insert(element, target) {

            this.$el.children().addClass(this.clsItem);

            var insert = () => {

                if (target.length) {

                    if (!this.$el.has(element).length || element.prevAll().filter(target).length) {
                        element.insertBefore(target);
                    } else {
                        element.insertAfter(target);
                    }

                } else {
                    this.$el.append(element);
                }

                this.$updateParents();
            };

            if (this.animation) {
                this.animate(insert);
            } else {
                insert();
            }

        },

        remove(element) {

            if (!this.$el.has(element).length) {
                return;
            }

            var remove = () => {
                element.remove();
                this.$updateParents();
            };

            if (this.animation) {
                this.animate(remove);
            } else {
                remove();
            }

        },

        animate(action) {

            var props = [],
                children = this.$el.children().toArray().map(el => {
                    el = $(el);
                    props.push(extend({
                        position: 'absolute',
                        pointerEvents: 'none',
                        width: el.outerWidth(),
                        height: el.outerHeight()
                    }, el.position()));
                    return el;
                }),
                reset = {position: '', width: '', height: '', pointerEvents: '', top: '', left: ''};

            action();

            children.forEach(el => el.stop());
            this.$el.children().css(reset);
            this.$updateParents();
            this.$el.css('min-height', this.$el.height());

            var positions = children.map(el => el.position());
            $.when.apply($, children.map((el, i) => el.css(props[i]).animate(positions[i], this.animation).promise()))
                .then(() => {
                    this.$el.css('min-height', '').children().css(reset);
                    this.$updateParents();
                });

        }

    }

});

function getSortable(element) {
    return UIkit.getComponent(element, 'sortable') || element.parentNode && getSortable(element.parentNode);
}

function preventClick() {
    var timer = setTimeout(() => doc.trigger('click'), 0),
        listener = e => {

            e.preventDefault();
            e.stopPropagation();

            clearTimeout(timer);
            off(doc, 'click', listener, true);
        };

    on(doc, 'click', listener, true);
}


(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    /**
     * Creates an event dispatcher that can be used to dispatch [component events](/docs#template-syntax-component-directives-on-eventname).
     * Event dispatchers are functions that can take two arguments: `name` and `detail`.
     *
     * Component events created with `createEventDispatcher` create a
     * [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).
     * These events do not [bubble](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#Event_bubbling_and_capture).
     * The `detail` argument corresponds to the [CustomEvent.detail](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail)
     * property and can contain any type of data.
     *
     * https://svelte.dev/docs#run-time-svelte-createeventdispatcher
     */
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail, { cancelable = false } = {}) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail, { cancelable });
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
                return !event.defaultPrevented;
            }
            return true;
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.58.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const ProverbStore = [
      { text: "Níor líon beannacht bolg riamh. -- A blessing never filled a belly", mood: "wise" },
      { text: "Bíonn blas ar an mbeagán. -- A little of anything is tasty", mood: "neutral" },
      { text: "Beatha duine a thoil -- Everyone to his own tastes", mood: "happy" },
      { text: "Aithnítear cara i gcruatan. -- It is in hardship that a friend is recognised", mood: "happy" },
      { text: "Bíonn caora dhubh ar an tréad is gile -- Even the whitest flock has a black sheep", mood: "neutral" },
      { text: "Galar gan náire an tart. -- Thirst is a shameless disease", mood: "serious" },

      { text: "Más maith leat do mholadh faigh bás: más maith leat do cháineadh pós. -- If you want to be praised, die: if you want to be criticized, marry", mood: "humorous" },

      { text: "Ag duine féin is fearr a fhios cá luíonn an bhróg air. -- A person best knows where the shoe troubles him", mood: "thoughtful" },
      { text: "Aithníonn ciaróg ciaróg eile.  -- It takes one to know one", mood: "humorous" },

      { text: "An gad is giorra don scornach is túisce is ceart a scaoileadh. -- The knot nearest the throat is the the one to release first", mood: "wise" },
      { text: "An lao ite i mbolg na bó. --Don't count your chickens before they're hatched", mood: "humorous" },
      { text: "An luibh ná faightear is í a fhóireann. -- The herb that can't be found is the very one which works", mood: "thoughtful" },
      { text: "An rud a chíonn an leanbh is é a níonn an leanbh. -- What the child sees the child does ", mood: "wise" },
      { text: "An rud a scríobhann an púca, léann sé féin é. -- What the ghost writes, the ghost reads", mood: "warning" },
      { text: "An rud a théann i bhfad téann sé i bhfuaire. -- What goes on for a long time loses its attractiveness", mood: "thoughtful" },
      { text: "An rud is annamh is iontach.", mood: "happy -- What's seldom is wonderful" },
      { text: "An rud is measa le duine ar domhan n’fheadair sé nach é lár a leasa é.", mood: "wise -- The very thing a person dreads most in the world could be the best thing for him" },
      { text: "An rud nach bhfuil leigheas air caithfear cur suas leis. -- What can't be cured must be endured", mood: "thoughtful" },
      { text: "An rud nach féidir ní féidir é. -- The impossible cannot be done", mood: "wise" },
      { text: "An t-uan ag múineadh méilí dá mháthair. -- The lamb teaching its mother how to bleat", mood: "humorous" },
      { text: "An tslat nuair a chruann le haois is deacair í a shníomh ina gad. -- hen the rod hardens with age it's difficult to bend it", mood: "thoughtful" },
      { text: "An té a bhfuil builín aige gheobhaidh sé scian lena ghearradh. -- The man who has a loaf will get a knife to cut it", mood: "humorous" },
      { text: "An té a bhíonn amuigh fuarann a chuid. -- The one who is out, his share gets cold", mood: "wise" },
      { text: "An té a bhíonn siúlach bíonn sé scéalach. -- Travellers have tales", mood: "wise" },
      { text: "An té a bhíonn thuas óltar deoch air. -- When you're up, they drink to you", mood: "happy" },
      { text: "An té a bhíonn thíos buailtear cos air. -- When you're down, they kick you", mood: "unlucky" },
      { text: "An té a dtéann teist na mochóirí amach air ní cás dó codladh go headra. -- The person who gains the reputation of getting up early can sleep late", mood: "wise" },
      { text: "An té a mbíonn an rath ar maidin air bíonn sé air tráthnóna. --  -- He who is lucky in the morning tends to be luck in the evening too", mood: "happy" },
      { text: "An té nach bhfuil láidir ní foláir dó bheith glic. -- He who is not strong has to be clever", mood: "wise" },
      { text: "An té nach mbeireann ar an ngnó beireann an gnó air. -- He who does not get a grip on the job, the job gets a grip on him", mood: "wise" },
      { text: "An té nach nglacann comhairle glacfaidh sé comhrac. -- Whoever will not accept advice must accept strife", mood: "wise" },

      { text: "An té nach trua leis do chás, ná déan do ghearán leis. -- He who does not sympathise with your plight, don't make your complaint to him", mood: "warning" },
    { text: "Ar mhaithe leis féin a níos an cat crónán. -- The cat purrs to please itself", mood: "happy" },
    { text: "Ar scath a chéile a mhaireann na daoine. -- People live in one another's shadow", mood: "wise" },
    { text: "Bailíonn brobh beart. -- A little gathers to a lot", mood: "neutral" },
    { text: "Beart gan leigheas, foighne is fearr dó. -- Patience is the best thing for an incurable situation", mood: "warning" },

    { text: "Beatha teanga í a labhairt. -- It's the life of a language to speak it", mood: "wise" },
    { text: "Beidh lá eile ag an bPaorach. -- Power will have another day", mood: "hopeful" },
    { text: "Bliain le duine agus bliain ina choinne. -- One year with you, one against you", mood: "neutral" },
    { text: "Breithnigh an abhainn sara dtéir ina cuilithe. -- Observe the river before you venture into its currents", mood: "wise" },
    { text: "Briseann an dúchas trí shúile an chait. -- Nature breaks out through the eyes of the cat", mood: "neutral" },
    { text: "Bíonn adharca fada ar na buaibh thar lear. -- Faraway cows have long horns", mood: "neutral" },
    { text: "Bíonn an fhírinne searbh. -- Truth is often bitter ", mood: "warning" },


    { text: "Bíonn blas milis ar phraiseach na gcomharsan. -- The neighbours gruel tastes sweet", mood: "happy" },

    { text: "Bíonn cead cainte ag fear caillte na himeartha. -- The man who has lost the match has permission to talk", mood: "wise" },
    { text: "Bíonn dhá insint ar gach aon scéal. -- There are two sides to every story", mood: "neutral" },
    { text: "Bíonn gach tosú lag. -- Every beginning is weak", mood: "neutral" },
    { text: "Bíonn súil le muir ach ní bhíonn súil le huaigh. -- There is hope of coming back from the sea but none of coming back from the dead", mood: "wise" },
    { text: "Cad a dhéanfadh mac an chait ach luch a mharú. -- Like father like son", mood: "neutral" },
    { text: "Cailín ag Móir is Móir ag iarraidh déirce. -- Mór has a servant girl while she herself is out begging", mood: "humorous" },
    { text: "Caora mhór an t-uan i bhfad. -- The lamb becomes a big heavy sheep over distance", mood: "neutral" },
    { text: "Chonaic mé cheana thú, arsa an cat leis an mbainne te. -- I saw you before, as the cat said to the warm milk...", mood: "humorous" },
    { text: "Ciall agus míchiall - dís ná gabhann le chéile. -- Sense and nonsense - two which do not go together", mood: "wise" },
    { text: "Cuir an breac san eangach sula gcuire tú sa phota é. -- Put the trout in the net before you put it in the pot", mood: "humorous" },
    { text: "Cuir síoda ar ghabhar - is gabhar fós é.-- Put silk on a goat, it's still a goat", mood: "humorous" },
    { text: "D’ordaigh Dia cúnamh. -- God helps those who help themselves", mood: "hopeful" },
    { text: "Doras feasa fiafraí. -- The door to wisdom is to ask questions", mood: "wise" },
    { text: "Dá dhonacht é Séamas ba mheasa bheith ina éagmais. -- However bad Séamas is it would be worse to be without him", mood: "thoughtful" },
    { text: "Dá fhad lá tagann oíche. -- However long the day, night comes", mood: "pensive" },
    { text: "Dá mbeadh soineann go Samhain bheadh breall ar dhuine éigin. -- If it was fine till Halloween someone would be unhappy", mood: "humorous" },
    { text: "Éire i bpáirt, Éire ar lár. -- Ireland divided is Ireland laid low", mood: "patriotic" },
    { text: "Éist le fuaim na habhann agus gheobhair breac. -- Listen to the sound of the river and you will catch a trout", mood: "wise" },
    { text: "Fear na bó faoina heireaball. -- The cows owner must go under her tail", mood: "humorous" },
    { text: "Feileann spallaí do bhallaí chomh maith le clocha móra. -- Small shards suit as well as big stones for building walls", mood: "happy" },
    { text: "Filleann an feall ar an bhfeallaire. -- The evil deed returns to the evildoer", mood: "thoughtful" },
    { text: "Gach dalta mar oiltear. -- Every pupil is as he is trained", mood: "hopeful" },

    { text: "Giorraíonn beirt bóthar. -- Two people shorten the road", mood: "humorous" },
    { text: "Glacann fear críonna comhairle. -- A wise man accepts advice", mood: "wise" },
    { text: "I dtosach na haicíde is fusa í a leigheas.-- It's at the beginning of the disease it is easiest to cure", mood: "thoughtful" },
    { text: "dtus an mhála is ceart a bheith tíosach. -- It's at the beginning of the bag that one must be economical", mood: "practical" },
    { text: "I ndiaidh a chéile a thógtar na caisleáin. -- Rome wasn't built in a day", mood: "hopeful" },
    { text: "Imíonn an tuirse is fanann an tairbhe. -- Tiredness goes away and the benefit remains", mood: "motivational" },
    { text: "Iomad den aithne a mheadaíonn an tarcaisne. -- Familiarity breeds contempt", mood: "wise" },
    { text: "Is ait an mac an saol. -- Life is strange", mood: "happy" },
    { text: "Is beo duine tar éis a bhuailte ach ní beo é tar éis a cháinte. -- A person is alive after being beaten but not after his good name is taken", mood: "philosophical" },
    { text: "Is binn béal ina thost. -- Sweet to hear is a mouth which is silent", mood: "humorous" },
    { text: "Is breá an ní an óige ach ní thagann sí faoi dhó. -- Youth is a fine thing but it does not come twice", mood: "nostalgic" },
    { text: "Is báidhiúil iad lucht aoncheirde. -- Birds of a feather flock together", mood: "admiring" },
    { text: "Is cuma nó muc duine gan seift. -- A shiftless person is the same as a pig", mood: "humorous" },
    { text: "Is deacair ceann críonna a chur ar cholainn óg. -- It's hard to put a wise head on young shoulders", mood: "wise" },
    { text: "Is deacair rogha a bhaint as dhá dhíogha -- It's hard to choose between two evils", mood: "wise" },
    { text: "Is dána gach madra i ndoras a thí féin. -- Every dog is bold in his own doorway", mood: "humorous" },
    { text: "Is dóigh le fear na buile gurb é féin fear na céille. -- The crazy man reckons he is the sensible one", mood: "thoughtful" },
    { text: "Is fada an bóthar nach bhfuil casadh ann. -- It's a long road that has no turning", mood: "neutral" },
    { text: "Is fada siar a théann iarsma an drochbhirt. -- The trail of a bad deed goes a long way", mood: "cautionary" },
    { text: "Is fearr a bheith díomhaoin ná droch-ghnóthach. -- Better to be idle than up to no good", mood: "neutral" },
    { text: "Is fearr an t-imreas ná an t-uaigneas. -- Arguing is better than loneliness", mood: "happy" },
    { text: "Is fearr an tsláinte ná na táinte. -- Health is better than wealth", mood: "happy" },
    { text: "Is fearr beagán den ghaol ná mórán den charthanas. -- A little relationship is better than a lot of charity", mood: "neutral" },
    { text: "Is fearr cara sa chúirt ná punt sa sparán. -- Better a friend in court than a pound in the purse", mood: "neutral" },
    { text: "Is fearr go mall ná go brách. -- Better late than never", mood: "neutral" },
    { text: "Is fearr leath ná meath. -- Half is better than nothing (literally: decaying)", mood: "neutral" },
    { text: "Is fearr lán doirn de cheird ná lán mála d’ór. -- A fistful of a trade is better than a bagful of gold", mood: "neutral" },
    { text: "Is fearr mac le himirt ná mac le hól. --  -- Better to have a son mad for sport than mad for drink", mood: "neutral" },
    { text: "Is fearr marcaíocht ar ghabhar ná coisíocht dá fheabhas. --  -- Better to ride on a goat than the finest walking", mood: "neutral" },
    { text: "Is fearr rith maith ná drochsheasamh. -- A good run is better than a bad stand", mood: "happy" },
    { text: "Is fearr súil le glas ná súil le huaigh. -- Better to look forward to prison than to the grave", mood: "neutral" },
    { text: "Is fearr súil romhat ná dhá shúil i do dhiaidh. -- Better one look before you than two behind", mood: "neutral" },
    { text: "Is furasta fuineadh in aice na béile. -- It's easy to knead next to the mill", mood: "happy" },
    { text: "Is gaire cabhair Dé ná an doras. -- God's help is nearer than the door", mood: "happy" },
    { text: "Is geal gach nua agus is searbh gach gnáth. -- Every novelty is great and every commonplace is bitter", mood: "neutral" },
    { text: "Is geal leis an bhfiach dubh a ghearrcach féin. -- The black raven thinks its own offspring is bright", mood: "happy" },
    { text: "Is geall le scíth malairt oibre. -- A change of work is as good as a rest", mood: "neutral" },
    { text: "Is glas iad na cnoic i bhfad uainn. -- Faraway hills are green", mood: "neutral" },
    { text: "Is iad na muca ciúine a itheann an mhin. -- It's the quiet pigs who eat the meal.", mood: "neutral" },
    { text: "Is in ithe na putóige a bhíonn a tástáil. -- The proof of the pudding is in the eating", mood: "neutral" },
    { text: "Is iomaí cor a chuireann an saol de. -- Life goes through many twists and turns", mood: "wise" },
    { text: "Is leor nod don eolach. -- A nod is enough to the wise", mood: "confident" },
    { text: "Is leor ó Mhór a dícheall. -- All anyone can do is his best", mood: "motivational" },
    { text: "Is lia gach othar i ndiaidh a leighis. -- Every patient is a surgeon after he is cured", mood: "cautionary" },
    { text: "Is lú ná fríd máthair an oilc. -- It takes very little to cause trouble", mood: "humorous" },
    { text: "Is mairg a dheanann deimhin dá dhóchas. -- Woe to he who checks out what he hopes to be true", mood: "thoughtful" },
    { text: "Is mairg a dhéanann an t-olc is a bhíonn bocht ina dhiaidh. -- Woe to the one who does evil and does not profit by it", mood: "cautionary" },
    { text: "Is maith an scáthán súil charad. -- A friend's eye is a good mirror", mood: "wise" },
    { text: "Is maith an scéalaí an aimsir. -- Time will tell", mood: "wise" },
    { text: "Is maith an t-anlann an t-ocras. -- Hunger is a good sauce", mood: "wise" },
    { text: "Is maith an t-iománaí an té a bhíonn ar an gclaí. -- The hurler on the ditch is a great fellow", mood: "motivational" },
    { text: "Is maith le Dia féin cúnamh. -- God himself likes a bit of help", mood: "religious" },
    { text: "Is maol gualainn gan bhráthair. -- A shoulder without a friend is undefended", mood: "humorous" },
    { text: "Is minic a bhris béal duine a shrón. -- It's often a person's mouth broke his nose", mood: "humorous" },
    { text: "Is minic a bhí cú mhall sona. -- It's often a slow hound was content", mood: "happy" },
    { text: "Is minic a gheall tailliúir is ná tiocfadh sé. -- It's often a tailor promised to come and did not", mood: "cautionary" },
    { text: "Is minic ciúin ciontach . -- The quiet ones are often guilty", mood: "thoughtful" },
    { text: "Is mór é luach na foighne. - Patience is worth a lot", mood: "wise" },
    { text: "Is olc an chearc nach scríobann di féin. -- It's a poor hen won't scratch for itself", mood: "humorous" },
    { text: "Is olc an ghaoth nach séideann do dhuine éigin. -- It's an ill wind blows nobody any good", mood: "cautionary" },
    { text: "Is sleamhain an leac ag doras duine uasail. -- The flagstone is slippery at the door of a decent man", mood: "cautionary" },
    { text: "Is treise dúchas ná oiliúint. -- Nature is stronger than training", mood: "wise" },
    { text: "Is trom cearc i bhfad. -- A small burden grows heavier with distance", mood: "humorous" },
    { text: "Is túisce deoch ná scéal. -- A small burden grows heavier with distance", mood: "happy" },
    { text: "Is í an chiall cheannaigh an chiall is fearr. -- Sense bought dearly is the best kind", mood: "wise" },
    { text: "Is í an dias is troime is ísle a chromann a ceann. -- It is the heaviest ear of corn which bows its head lowest", mood: "humorous" },
    { text: "Mair a chapaill is gheobhair féar. -- Live horse and you will get hay", mood: "motivational" },
    { text: "Maireann an chraobh ar an bhfál ach ní mhaireann an lámh a chuir. -- The branch lives on the fence but not the hand that planted it", mood: "wise" },
    { text: "Maireann croí éadrom i bhfad. -- Light heart lives long ", mood: "thoughtful" },
    { text: "Marbh le tae agus marbh gan é. -- Can't live with it, can't live without it", mood: "serious" },
    { text: "Mian mic a shúil. -- A child wants everything he sees", mood: "hopeful" },
    { text: "Mol an óige agus tiocfaidh sí. -- Praise youth and youth will respond", mood: "hopeful" },
    { text: "Mol gort is ná mol geamhar. -- Don't count your chickens before they are hatched", mood: "warning" },
    { text: "Mura gcuirfidh tú san Earrach ní bhainfidh tú sa bhFómhar. -- If you don't sow in Spring you won't reap in Autumn", mood: "warning" },
    { text: "Mura mbeadh agat ach pocán gabhair bí i lár an aonaigh leis. -- Even if you have only a puck goat to sell be in the middle of the fair with it", mood: "humorous" },
    { text: "Más cam díreach an ród is é an bóthar mór an t-aicearra. -- Be it crooked or straight, it's the main road is the shortest way", mood: "wise" },

    { text: "Más olc maol is measa mullach. -- If it's bad on the flat it's worse at the summit", mood: "warning" },
    { text: "Múineann gá seift. -- Necessity teaches resourcefulness", mood: "instructional" },
    { text: "Namhaid an cheird gan í a fhoghlaim. -- If you don't learn your trade, it becomes your enemy", mood: "wise" },
    { text: "Nuair a bheidh do lámh i mbéal na con tarraing go réidh í. -- When your hand is in the hound's mouth withdraw it gently", mood: "instructional" },
    { text: "Nuair a bhíonn an cat amuigh bíonn na lucha ag rince. -- When the cat's away the mice dance", mood: "descriptive" },
    { text: "Nuair is crua don chailleach caithfidh sí rith. -- When it's tough for the hag she has to run", mood: "humorous" },
    { text: "Nuair is gann é an bia is fial é a roinnt. -- When the food is scarce it's generous to share it", mood: "warning" },
    { text: "Ná bac le mac an bhacaigh is ní bhacfaidh mac an bhacaigh leat. -- Mind your own business", mood: "instructional" },
    { text: "Ná cuir do leas ar cairde. -- Don't procrastinate", mood: "instructional" },
    { text: "Ná déan nós is ná bris nós. -- Don't make a custom and don't break a custom", mood: "instructional" },
    { text: "Ná tabhair breith ar an gcéad scéal. -- Hear both sides before judgement", mood: "instructional" },
    { text: "Ní bheathaíonn na breithre na braithre. -- Words alone won't feed the brothers", mood: "wise" },
    { text: "Ní bhfuair minic onóir. -- Familiarity breeds contempt", mood: "disappointed" },
    { text: "Ní bhíonn an rath ach mar a mbíonn an smacht. -- No success without discipline", mood: "wise" },
    { text: "Ní bhíonn fear náireach éadálach. -- A shy man won't be rich", mood: "hopeful" },
    { text: "Ní bhíonn in aon rud ach seal. -- Nothing lasts for ever", mood: "wise" },
    { text: "Ní bhíonn tréan buan. -- The strong don't prevail for ever", mood: "wise" },
    { text: "Ní breac é go raibh sé ar an bport. -- Don't count your fish till it's landed", mood: "humorous" },
    { text: "Ní dhéanfadh an saol capall ráis d’asal.-- The world won't make a racehorse out of a donkey", mood: "wise" },
    { text: "Ní dhéanfaidh smaoineamh an treabhadh duit. -- Thinking will not do the ploughing for you", mood: "serious" },
    { text: "Ní fhaigheann lámh iata ach dorn dúnta. -- A closed hand gets nothing but a closed fist", mood: "serious" },
    { text: "Ní fiú bheith ag seanchas agus an anachain déanta. -- No point in talking when the damage is done", mood: "wise" },
    { text: "Ní féasta go rósta is ní céasta go pósta. -- It's not a feast without a roast and true suffering comes with marriage", mood: "humorous" },
    { text: "Ní féidir bheith ag feadaíl is ag ithe mine. -- You can't whistle and eat meal at the same time", mood: "wise" },
    { text: "Ní féidir leis an ngobadán an dá thrá a fhreastal. -- You can't be two places at once", mood: "humorous" },
    { text: "Ní féidir é a bheith ina ghruth is ina mheadhg agat. -- You can't have it both ways", mood: "wise" },
    { text: "Ní haithne go haontíos. -- You want to know me, come live with me", mood: "serious" },
    { text: "Ní heaspa go díth carad. -- There is no lack so bad as the lack of a friend", mood: "serious" },
    { text: "Ní hé lá na gaoithe lá na scolb. -- The windy day is not the day for thatching", mood: "wise" },
    { text: "Ní ionann dul go tigh an rí agus teacht as. -- It's not the same thing to go to the king's house and to come out of it", mood: "wise" },
    { text: "Ní lia duine ná tuairim. -- People are not more numerous than opinions", mood: "wise" },
    { text: "Ní lia tír ná gnás. -- There are not more countries than there are customs", mood: "wise" },
    { text: "Ní mar a shíltear a bhítear. -- Things aren't always what they seem", mood: "wise" },
    { text: "Ní mhealltar an sionnach faoi dhó. -- You won't fool the fox a second time", mood: "wise" },
    { text: "Ní neart go cur le chéile. -- There is no strength like co-operation", mood: "wise" },
    { text: "Ní sia gob an ghé na gob an ghandail. -- The goose's beak is no longer than the gander's", mood: "humorous" },
    { text: "Ní thagann ciall roimh aois. -- Sense does not come before age", mood: "wise" },
    { text: "Ní théann dlí ar riachtanas. -- Necessity overrides the law", mood: "wise" },
    { text: "Ní troimide an loch an lacha. -- The lake is not heavier for having the duck on it", mood: "wise" },
    { text: "Níl aon tinteán mar do thinteán féin. -- No place like home ", mood: "wise" },
    { text: "Níl leigheas ar an gcathú ach é a mharú le foighne.-- There is no cure for regret but to kill it with patience", mood: "serious" },
    { text: "Níl luibh ná leigheas in aghaidh an bháis. -- There is no herb or cure for death", mood: "serious" },
    { text: "Níl saoi gan locht ná daoi gan tréith. -- There is no wise man without a fault nor any fool without a good feature", mood: "wise" },
    { text: "Níl sprid ná puca nach bhfuil fios a chúise aige. -- There is no spirit nor ghost doesn't know his own business.", mood: "serious" },
    { text: "Níl tuile dá mhéad nach dtránn. -- There is no flood, however great, that does not ebb away", mood: "wise" },
    { text: "Níl íseal ná uasal ach thíos seal agus thuas seal. -- There is neither low not high but down for a while and up for a while.", mood: "wise" },
    { text: "Níor bhris focal maith fiacail riamh. -- A good word never broke a tooth", mood: "wise" },
    { text: "Níor chaill fear an mhisnigh riamh é. -- The man of courage never lost it", mood: "hopeful" },

    { text: "Pós bean ón sliabh agus pósfaidh tú an sliabh ar fad. -- Marry a woman from the mountain and you will marry the entire mountain", mood: "humorous" },
    { text: "Ritheann fear buile trí thuile go dána, ach is minic thug tuile fear buile le fána. -- A crazy man runs through a flood boldly, but it's often a flood swept a crazy man away", mood: "humorous" },
    { text: "Sciúrdann éan as gach ealta. -- A bird flies out of every flock", mood: "humorous" },
    { text: "Seachnaíonn súil an ní ná feiceann. -- An eye disregards what it does not see", mood: "cautionary" },
    { text: "Síoda ar Shiobhán is na preabáin ar a hathair. -- Silk on Siobhán and her father in rags", mood: "humorous" },
    { text: "Súil le breis a chailleann an cearrbhach -- Hoping to beats the odds is what ruins the gambler.", mood: "motivational" },
    { text: "Tabhair rogha don bhodach agus is é an díogha a thoghfaidh sé. -- Give a choice to the churl and it's the worst he will pick", mood: "humorous" },
    { text: "Tagann gach maith le cairde. -- No grace comes singly", mood: "happy" },
    { text: "Taithí a dhéanann máistreacht. -- Practice makes perfect", mood: "wise" },
    { text: "Tar éis a thuigtear gach beart. -- Hindsight is a great thing", mood: "thoughtful" },
    { text: "Tarraingíonn scéal scéal eile. -- One story leads on to another", mood: "cautionary" },
    { text: "Tosach sláinte codladh : deireadh sláinte osna. -- The beginning of health is sleep: the end of health is a sigh", mood: "humorous" },
    { text: "Tuigeann Tadhg Taidhgín. -- Like understands like", mood: "humorous" },
    { text: "Tír gan teanga tír gan anam. -- A country without a language is a country without a soul", mood: "patriotic" },
    { text: "Tús maith leath na hoibre. -- A good start is half the work", mood: "motivational" }
    ];

    /* src\Footer.svelte generated by Svelte v3.58.0 */

    const file$1 = "src\\Footer.svelte";

    function create_fragment$1(ctx) {
    	let footer;
    	let p;
    	let t0;
    	let a;

    	const block = {
    		c: function create() {
    			footer = element("footer");
    			p = element("p");
    			t0 = text("Made by Malachi Asgharian in ");
    			a = element("a");
    			a.textContent = "Meánscoil Gharman";
    			attr_dev(a, "href", "https://meanscoilgharman.com/");
    			add_location(a, file$1, 41, 48, 644);
    			attr_dev(p, "class", "p svelte-m5yesf");
    			add_location(p, file$1, 41, 6, 602);
    			attr_dev(footer, "class", "svelte-m5yesf");
    			add_location(footer, file$1, 40, 4, 587);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, footer, anchor);
    			append_dev(footer, p);
    			append_dev(p, t0);
    			append_dev(p, a);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(footer);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Footer', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Footer> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Footer",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.58.0 */

    const { console: console_1 } = globals;
    const file = "src\\App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[7] = list[i];
    	return child_ctx;
    }

    // (93:0) {#each filteredProverbs as proverb}
    function create_each_block(ctx) {
    	let div;
    	let t_value = /*proverb*/ ctx[7].text + "";
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(t_value);
    			attr_dev(div, "class", "card");
    			add_location(div, file, 93, 2, 2609);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*filteredProverbs*/ 1 && t_value !== (t_value = /*proverb*/ ctx[7].text + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(93:0) {#each filteredProverbs as proverb}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let nav;
    	let div1;
    	let div0;
    	let a;
    	let h3;
    	let t1;
    	let div2;
    	let h1;
    	let t3;
    	let select;
    	let option0;
    	let option1;
    	let option2;
    	let option3;
    	let option4;
    	let option5;
    	let option6;
    	let option7;
    	let option8;
    	let option9;
    	let option10;
    	let option11;
    	let t16;
    	let t17;
    	let footer;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = /*filteredProverbs*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			div1 = element("div");
    			div0 = element("div");
    			a = element("a");
    			h3 = element("h3");
    			h3.textContent = "BestIrishProverbs - All Irish proverbs in one place";
    			t1 = space();
    			div2 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Filter your proverbs by mood.";
    			t3 = space();
    			select = element("select");
    			option0 = element("option");
    			option0.textContent = "All";
    			option1 = element("option");
    			option1.textContent = "Wise";
    			option2 = element("option");
    			option2.textContent = "Thoughtful";
    			option3 = element("option");
    			option3.textContent = "Cautionary";
    			option4 = element("option");
    			option4.textContent = "Serious";
    			option5 = element("option");
    			option5.textContent = "Instructional";
    			option6 = element("option");
    			option6.textContent = "Motivational";
    			option7 = element("option");
    			option7.textContent = "Hopeful";
    			option8 = element("option");
    			option8.textContent = "Happy";
    			option9 = element("option");
    			option9.textContent = "Neutral";
    			option10 = element("option");
    			option10.textContent = "Humorous";
    			option11 = element("option");
    			option11.textContent = "Warning";
    			t16 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t17 = space();
    			create_component(footer.$$.fragment);
    			add_location(h3, file, 62, 18, 1831);
    			attr_dev(a, "href", "/");
    			attr_dev(a, "class", "svelte-5h8b9v");
    			add_location(a, file, 62, 6, 1819);
    			attr_dev(div0, "class", "navbar-element svelte-5h8b9v");
    			add_location(div0, file, 61, 4, 1784);
    			attr_dev(div1, "class", "navbar svelte-5h8b9v");
    			add_location(div1, file, 60, 2, 1759);
    			attr_dev(nav, "class", "svelte-5h8b9v");
    			add_location(nav, file, 59, 0, 1751);
    			attr_dev(h1, "href", "/");
    			add_location(h1, file, 75, 2, 1957);
    			option0.__value = "";
    			option0.value = option0.__value;
    			add_location(option0, file, 77, 2, 2041);
    			option1.__value = "wise";
    			option1.value = option1.__value;
    			add_location(option1, file, 78, 1, 2072);
    			option2.__value = "thoughtful";
    			option2.value = option2.__value;
    			add_location(option2, file, 79, 1, 2108);
    			option3.__value = "cautionary";
    			option3.value = option3.__value;
    			add_location(option3, file, 80, 1, 2156);
    			option4.__value = "serious";
    			option4.value = option4.__value;
    			add_location(option4, file, 81, 1, 2204);
    			option5.__value = "instructional";
    			option5.value = option5.__value;
    			add_location(option5, file, 82, 1, 2246);
    			option6.__value = "motivational";
    			option6.value = option6.__value;
    			add_location(option6, file, 83, 1, 2300);
    			option7.__value = "hopeful";
    			option7.value = option7.__value;
    			add_location(option7, file, 84, 1, 2352);
    			option8.__value = "happy";
    			option8.value = option8.__value;
    			add_location(option8, file, 85, 1, 2394);
    			option9.__value = "neutral";
    			option9.value = option9.__value;
    			add_location(option9, file, 86, 1, 2432);
    			option10.__value = "humorous";
    			option10.value = option10.__value;
    			add_location(option10, file, 87, 1, 2474);
    			option11.__value = "warning";
    			option11.value = option11.__value;
    			add_location(option11, file, 88, 1, 2518);
    			add_location(select, file, 76, 0, 2005);
    			attr_dev(div2, "class", "container");
    			add_location(div2, file, 73, 0, 1930);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, nav, anchor);
    			append_dev(nav, div1);
    			append_dev(div1, div0);
    			append_dev(div0, a);
    			append_dev(a, h3);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, h1);
    			append_dev(div2, t3);
    			append_dev(div2, select);
    			append_dev(select, option0);
    			append_dev(select, option1);
    			append_dev(select, option2);
    			append_dev(select, option3);
    			append_dev(select, option4);
    			append_dev(select, option5);
    			append_dev(select, option6);
    			append_dev(select, option7);
    			append_dev(select, option8);
    			append_dev(select, option9);
    			append_dev(select, option10);
    			append_dev(select, option11);
    			append_dev(div2, t16);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div2, null);
    				}
    			}

    			insert_dev(target, t17, anchor);
    			mount_component(footer, target, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(select, "change", /*handleChange*/ ctx[1], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*filteredProverbs*/ 1) {
    				each_value = /*filteredProverbs*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div2, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div2);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(t17);
    			destroy_component(footer, detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	const dispatch = createEventDispatcher();
    	let selectedMood = '';
    	let filteredProverbs = [];

    	function filterProverbs() {
    		$$invalidate(0, filteredProverbs = ProverbStore.filter(proverb => {
    			return selectedMood === '' || proverb.mood === selectedMood;
    		}));
    	}

    	let filteredPhrases = [];

    	function filterPhrases() {
    		$$invalidate(0, filteredProverbs = ProverbStore.filter(proverb => {
    			return selectedMood === '' || proverb.mood === selectedMood;
    		}));
    	}

    	console.log(ProverbStore);

    	function handleChange(event) {
    		selectedMood = event.target.value;
    		dispatch('filterPhrases', selectedMood);
    		filterPhrases();
    		const cards = document.querySelectorAll('.card'); // Select all the divs with class 'card'
    		const min = 240; // Set the minimum color value to 200
    		const max = 250; // Set the maximum color value to 240
    		const greyValue = Math.floor(Math.random() * (max - min + 1) + min); // Generate a random grey value between 200 and 240
    		const randomColor = `rgb(${greyValue}, ${greyValue}, ${greyValue})`; // Use the same value for red, green, and blue channels to create a shade of grey

    		cards.forEach(card => {
    			// Loop through each card
    			card.style.backgroundColor = randomColor; // Set the background color of the card to the random color

    			card.style.opacity = 0;
    			card.style.animation = 'none'; // Reset the animation

    			setTimeout(
    				() => {
    					card.style.animation = 'fade-in .5s ease-in-out forwards'; // Apply the animation after a delay
    					card.style.opacity = 1;
    				},
    				100
    			);
    		});
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		ProverbStore,
    		createEventDispatcher,
    		Footer,
    		dispatch,
    		selectedMood,
    		filteredProverbs,
    		filterProverbs,
    		filteredPhrases,
    		filterPhrases,
    		handleChange,
    		onMount
    	});

    	$$self.$inject_state = $$props => {
    		if ('selectedMood' in $$props) selectedMood = $$props.selectedMood;
    		if ('filteredProverbs' in $$props) $$invalidate(0, filteredProverbs = $$props.filteredProverbs);
    		if ('filteredPhrases' in $$props) filteredPhrases = $$props.filteredPhrases;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	filterProverbs();
    	return [filteredProverbs, handleChange];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
      target: document.body,
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map

/**
 * Sticky
 * Simone Conti
 * ver. 25/09/2018
 */
(function ($) {

	$.sticky = function (options) {

		init(options);
		fixTables();
		update();

		$(window).on('load.sticky', function () {
			fixTables();
			update();
		});

		$(window).on('scroll.sticky', $.throttle($.sticky.options.throttle, function () {
			update();
		}));

		$(window).on('scroll.sticky', $.debounce($.sticky.options.debounce, function () {
			checkForRefresh();
		}));

		$(window).on('resize.sticky', $.debounce($.sticky.options.debounce, function () {
			$.sticky.refresh();
		}));

	};

	$.sticky.refresh = function () {
		destroyAll();
		$.sticky($.sticky.options);
	}

	let init = function (options) {

		$(window).off('load.sticky');
		$(window).off('scroll.sticky');
		$(window).off('resize.sticky');

		$.sticky.itemsCount = countTotalVisibleItems();
		$.sticky.containers = [];
		$.sticky.externalTopElementsHeight = 0;
		$.sticky.externalBottomElementsHeight = 0;

		$.sticky.options = $.extend(true, {}, $.sticky.defaults, options);
		$.sticky.windowWidth = $(window).width();
		$.sticky.windowHeight = $(window).outerHeight(true);

		let $containers = $('[data-sticky-container]:visible');

		$containers.each(function () {
			let $container = $(this);
			let stacks = getStacks($container);
			let $stacks = $(stacks);
			$stacks.each(function () {
				let $stack = $(this);
				let elements = getElements($container, $stack);
				$stack.data('elements', elements);
			});
			$container.data('stacks', $stacks);
			$.sticky.containers.push($container);
		});

		// Calcolo l'altezza di tutti gli elementi (esterni al plugin) in position fixed-top.
		let $externalTopElements = $("[data-sticky-external-top-element]:visible");
		if ($externalTopElements.length > 0) {
			$.each($externalTopElements, function (index, value) {
				let $externalTopElement = $(value);
				$.sticky.externalTopElementsHeight += calculateElementHeight($externalTopElement);
			});
		}

		// Calcolo l'altezza di tutti gli elementi (esterni al plugin) in position fixed-bottom.
		let $externalBottomElements = $("[data-sticky-external-bottom-element]:visible");
		if ($externalBottomElements.length > 0) {
			$.each($externalBottomElements, function (index, value) {
				let $externalBottomElement = $(value);
				$.sticky.externalBottomElementsHeight += calculateElementHeight($externalBottomElement);
			});
		}

		$.each($.sticky.containers, function (index, value) {

			let $container = $(value);

			$container.addClass('sticky-container');

			let containerHeight = $container.outerHeight(true);
			$container.data("height", containerHeight);
			let containerMarginTop = parseInt($container.css('margin-top'));
			$container.data("marginTop", containerMarginTop);
			let containerMarginBottom = parseInt($container.css('margin-bottom'));
			$container.data("marginBottom", containerMarginBottom);
			let containerPaddingTop = parseInt($container.css('padding-top'));
			$container.data("paddingTop", containerPaddingTop);
			let containerPaddingBottom = parseInt($container.css('padding-bottom'));
			$container.data("paddingBottom", containerPaddingBottom);

			let $stacks = $container.data('stacks');

			$.each($stacks, function (index, value) {

				let $stack = $(value);
				let $elements = $stack.data('elements');

				let elementsHeight = [];
				let $spacers = [];
				let $placeholders = [];

				$.each($elements, function (index, value) {

					let $element = value;

					let elementHeight = calculateElementHeight($element);
					elementsHeight.push(elementHeight);

					let $spacer = createSpacer($element);
					$spacers.push($spacer);

					let $placeholder = createPlaceholder($element);
					$placeholders.push($placeholder);

					let elementMarginTop = parseInt($element.css('margin-top'));
					$element.data("marginTop", elementMarginTop);
					let elementMarginBottom = parseInt($element.css('margin-bottom'));
					$element.data("marginBottom", elementMarginBottom);
					let elementBorderTop = parseInt($element.css('border-top-width'));
					$element.data("borderTop", elementBorderTop);
					let elementBorderBottom = parseInt($element.css('border-bottom-width'));
					$element.data("borderBottom", elementBorderBottom);
					let elementWidth = $element.css('width');
					$element.data("width", elementWidth);

					// Tolgo il position relative a tutti i padri dell'elemento fino al container,
					// per poter fare un position absolute in relazione al container.
					let $parentsUntilContainer = $element.parentsUntil($container);
					if ($parentsUntilContainer.length > 0) {
						$.each($parentsUntilContainer, function (index, value) {
							let $parent = $(value);
							if ($parent.css('position') === 'relative') {
								$parent.addClass("force-position-static");
							}
						});
					}
				});
				$stack.data('elementsHeight', elementsHeight);
				$stack.data('spacers', $spacers);
				$stack.data('placeholders', $placeholders);
			});
		});
	}

	let update = function () {

		let docViewTop = $(window).scrollTop();

		$.each($.sticky.containers, function (index, value) {

			let $container = $(value);

			let $stacks = $container.data('stacks');

			$.each($stacks, function (index, value) {

				let $stack = $(value);

				let $elements = $stack.data('elements');
				let elementsHeight = $stack.data('elementsHeight');
				let $spacers = $stack.data('spacers');
				let $placeholders = $stack.data('placeholders');

				if ($elements.length == 0) {
					return true;
				}

				let containerHeight = $container.data("height");
				let containerTop = $container.offset().top;
				let containerBottom = containerTop + containerHeight;
				let containerMarginTop = $container.data("marginTop");
				let containerMarginBottom = $container.data("marginBottom");
				let containerPaddingTop = $container.data("paddingTop");
				let containerPaddingBottom = $container.data("paddingBottom");

				// Calcolo l'altezza di tutti gli elementi già stickati al di fuori di questo container.
				let otherElementsHeight = 0;
				let $otherContainers = $container.parents('[data-sticky-container]:visible');
				if ($otherContainers.length > 0) {
					$.each($otherContainers, function (index, value) {
						let $otherContainer = $(value);
						let stickiedElementsTotalHeight = $otherContainer.data("stickied-elements-total-height");
						if (!isNaN(stickiedElementsTotalHeight)) {
							otherElementsHeight += $otherContainer.data("stickied-elements-total-height");
						}
					});
				}

				// Vedo se la somma delle altezze degli elementi da mettere in sticky è minore dell'altezza dello schermo.
				// In caso contrario non applico il plugin.
				if (!checkHeights($container, $stack, $elements, elementsHeight, containerPaddingTop, otherElementsHeight)) {
					destroyStack($stack);
					return true;
				}

				$.each($elements, function (index, value) {

					let $element = value;
					let elementHeight = elementsHeight[index];
					let $spacer = $spacers[index];
					let $placeholder = $placeholders[index];

					let elementMarginTop = $element.data("marginTop");
					let elementMarginBottom = $element.data("marginBottom");
					let elementBorderTop = $element.data("borderTop");
					let elementBorderBottom = $element.data("borderBottom");
					let elementWidth = $element.data("width");

					let placeholderTop = $placeholder.offset().top;
					let placeholderAndContainerDistanceTop = placeholderTop - containerTop;
					let zIndex = getElementZIndex($element);

					// Calcolo l'altezza di tutti gli elementi precedenti a quello corrente
					let previousElementsHeight = 0;
					for (let i = 0; i < index; i++) {
						previousElementsHeight += elementsHeight[i];
					}

					// Calcolo l'altezza di tutti gli elementi successivi a quello corrente
					let nextElementsHeight = 0;
					for (let i = index + 1; i < $elements.length; i++) {
						nextElementsHeight += elementsHeight[i];
					}

					let valueToApplyStickyBottom = 0;
					valueToApplyStickyBottom += containerBottom;
					valueToApplyStickyBottom -= elementHeight;
					valueToApplyStickyBottom -= previousElementsHeight;
					valueToApplyStickyBottom -= nextElementsHeight;
					if (!isIgnoreContainerPaddingTop($container)) {
						valueToApplyStickyBottom -= containerPaddingTop;
					}
					if (!isIgnoreContainerPaddingBottom($container)) {
						valueToApplyStickyBottom -= containerPaddingBottom;
					}
					valueToApplyStickyBottom -= containerMarginTop;
					valueToApplyStickyBottom -= containerMarginBottom;
					valueToApplyStickyBottom -= otherElementsHeight;
					valueToApplyStickyBottom -= $.sticky.externalTopElementsHeight;

					let valueToApplyStickyTop = 0;
					valueToApplyStickyTop += containerTop;
					if (!isIgnoreContainerPaddingTop($container)) {
						valueToApplyStickyTop -= containerPaddingTop;
					}
					valueToApplyStickyTop += placeholderAndContainerDistanceTop;
					valueToApplyStickyTop -= previousElementsHeight;
					if (isIgnoreElementMarginTop($element)) {
						valueToApplyStickyTop += elementMarginTop;
					}
					if (isIgnoreElementBorderTop($element)) {
						valueToApplyStickyTop += elementBorderTop;
					}
					valueToApplyStickyTop -= otherElementsHeight;
					valueToApplyStickyTop -= $.sticky.externalTopElementsHeight;

					if (docViewTop > valueToApplyStickyBottom) {
						let bottom = 0;
						bottom += nextElementsHeight;
						if (!isIgnoreContainerPaddingBottom($container)) {
							bottom += containerPaddingBottom;
						}
						if (isIgnoreElementMarginBottom($element)) {
							bottom -= elementMarginBottom;
						}
						if (isIgnoreElementBorderBottom($element)) {
							bottom -= elementBorderBottom;
						}
						$element.removeClass('stickied-top');
						$element.css('top', 'auto');
						$element.addClass('stickied-bottom');
						$element.css('bottom', bottom);
						$element.css('width', elementWidth);
						$element.css('z-index', zIndex);
						$spacer.show();
					} else if (docViewTop > valueToApplyStickyTop) {
						let top = 0;
						top += previousElementsHeight;
						if (!isIgnoreContainerPaddingTop($container)) {
							top += containerPaddingTop;
						}
						if (isIgnoreElementMarginTop($element)) {
							top -= elementMarginTop;
						}
						if (isIgnoreElementBorderTop($element)) {
							top -= elementBorderTop;
						}
						top += otherElementsHeight;
						top += $.sticky.externalTopElementsHeight;
						$element.removeClass('stickied-bottom');
						$element.css('bottom', 'auto');
						$element.addClass('stickied-top');
						$element.css('top', top);
						$element.css('width', elementWidth);
						$element.css('z-index', zIndex);
						$spacer.show();
					} else {
						destroyElement($element, $spacer);
					}
				});

				// Calcolo l'altezza di tutti gli elementi stickati e me la metto da parte
				let stickiedElementsTotalHeight = 0;
				$.each($elements, function (index, value) {
					let $element = value;
					if ($element.hasClass("stickied-top")) {
						stickiedElementsTotalHeight += elementsHeight[index];
					}
				});
				$stack.data("stickied-elements-total-height", stickiedElementsTotalHeight);
			});

		});
	};

	let checkForRefresh = function () {

		// Resetto il plugin nel caso in cui cambi il numero di elementi da controllare
		let itemsCount = countTotalVisibleItems();
		if (itemsCount != $.sticky.itemsCount) {
			$.sticky.itemsCount = itemsCount;
			$.sticky.refresh();
			return false;
		}

		// Resetto il plugin nel caso in cui cambi l'altezza di un'elemento
		$.each($.sticky.containers, function (index, value) {
			let $container = $(value);
			let $elements = $container.data('elements');
			let $spacers = $container.data('spacers');
			$.each($elements, function (index, value) {
				let $element = value;
				let $spacer = $spacers[index];
				if (($spacer.outerHeight(false)) != ($element.outerHeight(false))) {
					$.sticky.refresh();
					return false;
				}
			});
		});

		// Resetto il plugin nel caso in cui cambi l'altezza di un container
		$.each($.sticky.containers, function (index, value) {
			let $container = $(value);
			let actualContainerHeight = $container.outerHeight(true);
			let previousContainerHeight = $container.data("height");
			if (actualContainerHeight != previousContainerHeight) {
				$.sticky.refresh();
				return false;
			}
		});

	}

	let destroyElement = function ($element, $spacer) {
		$element.removeClass('stickied-top');
		$element.css('top', 'auto');
		$element.removeClass('stickied-bottom');
		$element.css('width', '');
		$element.css('z-index', 'auto');
		if ($spacer != null) {
			$spacer.hide();
		}
	}

	let destroyStack = function ($stack) {
		let $elements = $stack.data('elements');
		let $spacers = $stack.data('spacers');
		$.each($elements, function (index, value) {
			let $element = value;
			let $spacer = $spacers[index];
			destroyElement($element, $spacer);
		});
	}

	let destroyAll = function () {
		$.each($.sticky.containers, function (index, value) {
			let $container = $(value);
			let $stacks = $container.data('stacks');
			$.each($stacks, function (index, value) {
				let $stack = $(value);
				destroyStack($stack);
			});
		});
	}

	let getStacks = function ($container) {

		let stacks = $container.find('[data-sticky-stack]:visible');
		let $stacks = [];

		$.each(stacks, function (index, value) {
			let $stack = $(value);
			let $closestStickyContainer = $stack.parents('[data-sticky-container]:visible').first();
			if ($closestStickyContainer.is($container)) {
				$stacks.push($stack);
			}
		});

		// Se il container non ha degli stack, il container stesso fa da stack.
		if ($stacks.length === 0) {
			$stacks.push($container);
		}

		return $stacks;
	}

	let getElements = function ($container, $stack) {

		let elements = $stack.find('[data-sticky-element]:visible');
		let $elements = [];

		$.each(elements, function (index, value) {
			let $element = $(value);
			let elementMinWindowWidth = getElementMinWindowWidth($element);
			if ($.sticky.windowWidth > elementMinWindowWidth) {
				let $closestStickyContainer = $element.parents('[data-sticky-container]:visible').first();
				if ($closestStickyContainer.is($container)) {
					$elements.push($element);
				}
			}
		});

		$elements = sortByIndex($elements);

		return $elements;
	}

	let calculateElementHeight = function ($element) {
		let elementHeight = 0;
		// altezza elemento
		elementHeight += $element.outerHeight(false);
		// margin top
		if (!isIgnoreElementMarginTop($element)) {
			elementHeight += parseInt($element.css('margin-top'));
		}
		// margin bottom
		if (!isIgnoreElementMarginBottom($element)) {
			elementHeight += parseInt($element.css('margin-bottom'));
		}
		// border top
		if (isIgnoreElementBorderTop($element)) {
			elementHeight -= parseInt($element.css('border-top-width'));
		}
		// border bottom
		if (isIgnoreElementBorderBottom($element)) {
			elementHeight -= parseInt($element.css('border-bottom-width'));
		}
		return elementHeight;
	}

	let sortByIndex = function ($elements) {
		function compare(a, b) {
			if (a.data('sticky-element') < b.data('sticky-element'))
				return -1;
			if (a.data('sticky-element') > b.data('sticky-element'))
				return 1;
			return 0;
		}
		return $elements.sort(compare);
	}

	let createSpacer = function ($element) {
		let $spacer;
		let $nextElement = $element.next();
		if ($nextElement.hasClass('sticky-spacer')) {
			$spacer = $nextElement;
		} else {
			$spacer = $("<div class='sticky-spacer'>");
			$spacer.insertAfter($element);
		}
		$spacer.height($element.outerHeight(false));
		$spacer.css("margin-top", $element.css("margin-top"));
		$spacer.css("margin-bottom", $element.css("margin-bottom"));
		return $spacer;
	}

	let createPlaceholder = function ($element) {
		let $placeholder;
		let $previousElement = $element.prev();
		if ($previousElement.hasClass('sticky-placeholder')) {
			$placeholder = $previousElement;
		} else {
			$placeholder = $("<div class='sticky-placeholder'>");
			$placeholder.insertBefore($element);
		}
		return $placeholder;
	}

	let checkHeights = function ($container, $stack, $elements, elementsHeight, containerPaddingTop, otherElementsHeight) {
		let heightNeeded = 0;
		$.each($elements, function (index) {
			heightNeeded += elementsHeight[index];
		});
		if (!isIgnoreContainerPaddingTop($container)) {
			heightNeeded += containerPaddingTop;
		}
		heightNeeded += otherElementsHeight;
		heightNeeded += $.sticky.externalTopElementsHeight;
		heightNeeded += $.sticky.externalBottomElementsHeight;
		return $.sticky.windowHeight > heightNeeded;
	}

	let fixTables = function () {
		$.each($.sticky.containers, function (index, value) {
			let $container = $(value);
			let $stacks = $container.data('stacks');
			$.each($stacks, function (index, value) {
				let $stack = $(value);
				let $elements = $stack.data('elements');
				$.each($elements, function (index, value) {
					let $elements = $(value);
					let $spacers = $stack.data('spacers');
					$.each($elements, function (index, value) {
						let $element = $(value);
						let $spacer = $spacers[index];
						if ($element.is("thead") || $element.is("tr")) {
							destroyElement($element, $spacer);
							$element.find("th, td").css("width", "");
							let $table = $element.closest("table");
							if ($table.find("colgroup").length != 0) {
								$table.find("colgroup").first().remove();
							}
							let $colgroup = $("<colgroup>");
							$table.prepend($colgroup);
							$element.find("th, td").each(function () {
								let $th = $(this);
								let $col = $("<col>");
								let thWidth = $th.outerWidth();
								$th.outerWidth(thWidth);
								$col.outerWidth(thWidth);
								$colgroup.append($col);
							});
						}
						// Se si tratta di un thead, sposto il suo placeholder fuori dalla tabella, subito prima, perchè altrimenti disturba il rendering.
						if ($element.is("thead") || $element.is("tr")) {
							let $placeholder = $element.prev();
							if ($placeholder.hasClass('sticky-placeholder')) {
								let $table = $element.closest("table");
								$placeholder.insertBefore($table);
							}
						}
					});
				});
			});
		});
	}

	let countTotalVisibleItems = function () {
		let containers = $('[data-sticky-container]:visible');
		let elements = $('[data-sticky-element]:visible');
		return containers.length + elements.length;
	}

	let isIgnoreContainerPaddingTop = function ($container) {
		let ignore = $container.data('sticky-container-ignore-padding-top');
		if (ignore == null) {
			ignore = $.sticky.options.ignoreContainerPaddingTop;
		}
		return ignore;
	}

	let isIgnoreContainerPaddingBottom = function ($container) {
		let ignore = $container.data('sticky-container-ignore-padding-bottom');
		if (ignore == null) {
			ignore = $.sticky.options.ignoreContainerPaddingBottom;
		}
		return ignore;
	}

	let isIgnoreElementMarginTop = function ($element) {
		let ignore = $element.data('sticky-element-ignore-margin-top');
		if (ignore == null) {
			ignore = $.sticky.options.ignoreElementMarginTop;
		}
		return ignore;
	}

	let isIgnoreElementMarginBottom = function ($element) {
		let ignore = $element.data('sticky-element-ignore-margin-bottom');
		if (ignore == null) {
			ignore = $.sticky.options.ignoreElementMarginBottom;
		}
		return ignore;
	}

	let isIgnoreElementBorderTop = function ($element) {
		let ignore = $element.data('sticky-element-ignore-border-top');
		if (ignore == null) {
			ignore = $.sticky.options.ignoreElementBorderTop;
		}
		return ignore;
	}

	let isIgnoreElementBorderBottom = function ($element) {
		let ignore = $element.data('sticky-element-ignore-border-bottom');
		if (ignore == null) {
			ignore = $.sticky.options.ignoreElementBorderBottom;
		}
		return ignore;
	}

	let getElementZIndex = function ($element) {
		let zIndex = $element.data('sticky-element-z-index');
		if (zIndex == null) {
			zIndex = $.sticky.options.zIndex;
		}
		return zIndex;
	}

	let getElementMinWindowWidth = function ($element) {
		let minWindowWidth = $element.data('sticky-element-min-window-width');
		if (minWindowWidth == null) {
			minWindowWidth = $.sticky.options.minWindowWidth;
		}
		return minWindowWidth;
	}

	$.sticky.defaults = {
		ignoreContainerPaddingTop: true,
		ignoreContainerPaddingBottom: false,
		ignoreElementMarginTop: true,
		ignoreElementMarginBottom: false,
		ignoreElementBorderTop: true,
		ignoreElementBorderBottom: false,
		zIndex: 1,
		minWindowWidth: 0,
		throttle: 10,
		debounce: 100
	};

	$.sticky.options;
	$.sticky.containers;
	$.sticky.itemsCount;
	$.sticky.externalTopElementsHeight;
	$.sticky.externalBottomElementsHeight;
	$.sticky.windowWidth;
	$.sticky.windowHeight;

})(jQuery);
$(document).ready(function () {
  $(window).scroll(function () {
    if ($(this).scrollTop() >= 100) {
      $(".scrollTop").fadeIn();
    } else {
      $(".scrollTop").fadeOut();
    }
  });

  // accodions start
  $(".faqItem__Body_").hide();
  $(".faqItem__Header_").click(function () {
    $(".faqItem__Body_").not($(this).next(".faqItem__Body_")).slideUp();
    $(this).next(".faqItem__Body_").slideToggle();
    $(".faqItem__Header_Arrow")
      .not($(this).children(".faqItem__Header_Arrow"))
      .removeClass("arrowActive");
    $(this).children(".faqItem__Header_Arrow").toggleClass("arrowActive");
  });

  $(".menuIcon").on("click", function () {
    $(".sideBar__").toggleClass("sideBar__Active");
  });

  $(".sideBar_drop_anker").on("click", function () {
    $(this).siblings(".sideBar_down").slideToggle();
    $(this).children("span:nth-child(2)").toggleClass("arrowActiveSide");
  });

  $(".sideBar__Header__Close").on("click", function () {
    $(".sideBar__").toggleClass("sideBar__Active");
  });

  $(".scrollTop").click(function () {
    $("html, body").animate({ scrollTop: 0 }, 500);
  });

  $(".odometer").each(function () {
    var countNumber = parseInt($(this).attr("data-count"));
    var odometer = new Odometer({
      el: this,
      value: 0,
      format: "d", // Use 'd' for integers
      duration: 2000, // Animation duration in milliseconds
    });
    odometer.render();
    odometer.update(countNumber);
  });

  $(".floatingCall__").hover(
    function () {
      $(this).stop().animate({ right: "0" }, 300);
    },
    function () {
      $(this).stop().animate({ right: "-246px" }, 300);
    }
  );

  // svg replace inline svg code

  $("img.svg").each(function () {
    var $img = $(this);
    var imgID = $img.attr("id");
    var imgClass = $img.attr("class");
    var imgURL = $img.attr("src");
    $.get(
      imgURL,
      function (data) {
        $svg = $(data).find("svg");
        if (imgID) $svg = $svg.attr("id", imgID);
        if (imgClass) $svg = $svg.attr("class", imgClass + " replaced-svg");
        $svg = $svg.removeAttr("xmlns:a");
        $img.replaceWith($svg);
      },
      "xml"
    );
  });

  const rangeInput = document.getElementById("month_wise");

  const tickmarks = document.getElementById("tickmarks");

  rangeInput.addEventListener("input", (e) => {
    const selectedOption = tickmarks.querySelector(
      `option[value="${rangeInput.value}"]`
    );
    rangeInput.setAttribute("aria-valuetext", selectedOption.label);
  });

  const rangeInput_year = document.getElementById("year_wise");
  const tickmarks_year = document.getElementById("tickmarks_year");

  rangeInput_year.addEventListener("input", (e) => {
    const selectedOption = tickmarks_year.querySelector(
      `option[value="${rangeInput_year.value}"]`
    );
    rangeInput_year.setAttribute("aria-valuetext", selectedOption.label);
  });

  let amount_pa = Number($("#investment_amount").val());
  let month_pa = Number($("#month_wise").attr("aria-valuetext"));
  let interestRate_pa = Number($("#month_wise").attr("data-per"));

  investment_by_months(amount_pa, interestRate_pa, month_pa);

  $("#investment_amount").on("change input", function () {
    $(this)
      .parent()
      .parent()
      .find("#input_range")
      .val(currency_converter($(this).val()).toString());

    let amount = Number($(this).val());

    if ($("#invest_select").val() == "with-due") {
      let months = Number($("#month_wise").attr("aria-valuetext"));

      let interestRate = Number($("#month_wise").attr("data-per"));

      investment_by_amount(amount, interestRate, months);
    } else {
      let months = Number($("#year_wise").attr("aria-valuetext"));

      let interestRate = Number($("#year_wise").attr("data-per"));

      investment_by_amount(amount, interestRate, months);
    }
  });
  $(".investment_month").on("change input", function () {
    let amount = Number($("#investment_amount").val());
    let months;

    // Define the principal amount and investment period in months

    // Calculate the interest rate based on the investment period
    let interestRate;
    if ($(this).attr("id") != "year_wise") {
      $(this)
        .parent()
        .parent()
        .find("#input_range")
        .val($(this).attr("aria-valuetext"));

      months = Number($(this).attr("aria-valuetext"));

      if (months == 6) {
        interestRate = 0.037;
      } else if (months == 12) {
        interestRate = 0.043;
      } else if (months == 24) {
        interestRate = 0.046;
      } else if (months == 36) {
        interestRate = 0.0475;
      } else if (months == 60) {
        interestRate = 0.0485;
      } else if (months == 120) {
        interestRate = 0.0552;
      } else {
        alert("invalid month");
      }
    } else {
      months = Number($(this).attr("aria-valuetext"));

      $(this).parent().parent().find("#input_range").val(months);

      if (months == 6) {
        interestRate = 0.043;
      } else if (months == 12) {
        interestRate = 0.046;
      } else if (months == 24) {
        interestRate = 0.049;
      } else if (months == 36) {
        interestRate = 0.0505;
      } else if (months == 60) {
        interestRate = 0.052;
      } else if (months == 120) {
        interestRate = 0.053;
      } else {
        alert("invalid year");
      }
    }

    let rate = getrates(amount, interestRate, months);
    $(this).attr("data-per", rate);

    investment_by_months(amount, interestRate, months);
  });

  $("#invest_select").on("change", function () {
    if ($(this).val() == "each-year") {
      // $('.when_due').find('#input_range').val()
      //let months = Number($("#year_wise").val());

      months = Number($("#year_wise").attr("aria-valuetext"));

      let interestRate = Number($("#year_wise").attr("data-per"));

      let amount = Number($("#investment_amount").val());

      investment_by_months(amount, interestRate, months);
      if (
        Number($(".when_due").find("#input_range").val()) <
        Number($(".year").find(".investment_month").attr("min"))
      ) {
        $(".year")
          .find("#input_range")
          .val($(".when_due").find("#input_range").val());
        $(".year")
          .find(".investment_month")
          .val($(".when_due").find("#month_wise").val());
      }

      $(".when_due").toggleClass("hide");

      $(".year").toggleClass("hide");
    } else {
      $(".when_due")
        .find("#input_range")
        .val($(".year").find("#input_range").val());
      $(".when_due")
        .find(".investment_month")
        .val($(".year").find("#year_wise").val());

      let months = Number($("#month_wise").attr("aria-valuetext"));
      let interestRate = Number($("#month_wise").attr("data-per"));

      let amount = Number($("#investment_amount").val());

      investment_by_months(amount, interestRate, months);

      $(".when_due").toggleClass("hide");
      $(".year").toggleClass("hide");
    }
  });

  function investment_by_amount(amount, interestRate, months) {
    let rate = getrates(amount, interestRate, months);

    let total_value = ((amount * rate) / 12) * months;
    $("#total_price").html(currency_converter(total_value));
	      $(".interest_per").html(Number(rate * 100).toFixed(2));

  }

  function investment_by_months(amountx, interestRatex, monthsx) {
    let rate = getrates(amountx, interestRatex, monthsx);
    let total_value = ((amountx * rate) / 12) * monthsx;

    $("#total_price").html(currency_converter(total_value));
    $(".interest_per").html(Number(rate * 100).toFixed(2));
  }

  function currency_converter(amount_c) {
    const formattedIncome = Number(amount_c).toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return formattedIncome;
  }

  function currency_converter_without_zero(amount_c) {
    const formattedIncome = Number(amount_c).toLocaleString("de-DE", {});

    return formattedIncome;
  }

  function getrates(amount, interestRate, months) {
    if (amount == 20000) {
      if (months == 6) {
        interestRate = 0.036;
        return interestRate;
      } else if (months == 12) {
        interestRate = 0.042;
        return interestRate;
      } else if (months == 24) {
        interestRate = 0.045;
        return interestRate;
      } else if (months == 36) {
        interestRate = 0.0465;
        return interestRate;
      } else if (months == 60) {
        interestRate = 0.0475;
        return interestRate;
      } else if (months == 120) {
        interestRate = 0.048;
        return interestRate;
      } else {
        alert("invalid month");
      }
    } else if (amount == 30000) {
      if (months == 6) {
        interestRate = 0.037;
        return interestRate;
      } else if (months == 12) {
        interestRate = 0.043;
        return interestRate;
      } else if (months == 24) {
        interestRate = 0.046;
        return interestRate;
      } else if (months == 36) {
        interestRate = 0.0475;
        return interestRate;
      } else if (months == 60) {
        interestRate = 0.0485;
        return interestRate;
      } else if (months == 120) {
        interestRate = 0.049;
        return interestRate;
      } else {
        alert("invalid month");
      }
    } else if (amount == 40000) {
      if (months == 6) {
        interestRate = 0.038;
        return interestRate;
      } else if (months == 12) {
        interestRate = 0.044;
        return interestRate;
      } else if (months == 24) {
        interestRate = 0.047;
        return interestRate;
      } else if (months == 36) {
        interestRate = 0.049;
        return interestRate;
      } else if (months == 60) {
        interestRate = 0.0505;
        return interestRate;
      } else if (months == 120) {
        interestRate = 0.051;
        return interestRate;
      } else {
        alert("invalid month");
      }
    } else if (amount == 50000) {
      if (months == 6) {
        interestRate = 0.042;
        return interestRate;
      } else if (months == 12) {
        interestRate = 0.045;
        return interestRate;
      } else if (months == 24) {
        interestRate = 0.048;
        return interestRate;
      } else if (months == 36) {
        interestRate = 0.0495;
        return interestRate;
      } else if (months == 60) {
        interestRate = 0.0505;
        return interestRate;
      } else if (months == 120) {
        interestRate = 0.052;
        return interestRate;
      } else {
        alert("invalid month");
      }
    } else if (amount == 60000) {
      if (months == 6) {
        interestRate = 0.043;
        return interestRate;
      } else if (months == 12) {
        interestRate = 0.046;
        return interestRate;
      } else if (months == 24) {
        interestRate = 0.049;
        return interestRate;
      } else if (months == 36) {
        interestRate = 0.0505;
        return interestRate;
      } else if (months == 60) {
        interestRate = 0.052;
        return interestRate;
      } else if (months == 120) {
        interestRate = 0.053;
        return interestRate;
      } else {
        alert("invalid month");
      }
    } else if (amount == 70000) {
      if (months == 6) {
        interestRate = 0.044;
        return interestRate;
      } else if (months == 12) {
        interestRate = 0.047;
        return interestRate;
      } else if (months == 24) {
        interestRate = 0.0505;
        return interestRate;
      } else if (months == 36) {
        interestRate = 0.052;
        return interestRate;
      } else if (months == 60) {
        interestRate = 0.053;
        return interestRate;
      } else if (months == 120) {
        interestRate = 0.054;
        return interestRate;
      } else {
        alert("invalid month");
      }
    } else if (amount == 80000) {
      if (months == 6) {
        interestRate = 0.045;
        return interestRate;
      } else if (months == 12) {
        interestRate = 0.048;
        return interestRate;
      } else if (months == 24) {
        interestRate = 0.0505;
        return interestRate;
      } else if (months == 36) {
        interestRate = 0.052;
        return interestRate;
      } else if (months == 60) {
        interestRate = 0.053;
        return interestRate;
      } else if (months == 120) {
        interestRate = 0.054;
        return interestRate;
      } else {
        alert("invalid month");
      }
    } else if (amount == 90000) {
      if (months == 6) {
        interestRate = 0.046;
        return interestRate;
      } else if (months == 12) {
        interestRate = 0.049;
        return interestRate;
      } else if (months == 24) {
        interestRate = 0.0515;
        return interestRate;
      } else if (months == 36) {
        interestRate = 0.0535;
        return interestRate;
      } else if (months == 60) {
        interestRate = 0.054;
        return interestRate;
      } else if (months == 120) {
        interestRate = 0.055;
        return interestRate;
      } else {
        alert("invalid month");
      }
    } else if (amount == 100000) {
      if (months == 6) {
        interestRate = 0.047;
        return interestRate;
      } else if (months == 12) {
        interestRate = 0.0495;
        return interestRate;
      } else if (months == 24) {
        interestRate = 0.052;
        return interestRate;
      } else if (months == 36) {
        interestRate = 0.054;
        return interestRate;
      } else if (months == 60) {
        interestRate = 0.055;
        return interestRate;
      } else if (months == 120) {
        interestRate = 0.056;
        return interestRate;
      } else {
        alert("invalid month");
      }
    } else {
      alert("invalid amount");
    }
  }
});

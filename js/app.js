;(() => {
  'use strict';
  const app = angular.module('app', ['ngMaterial', 'ngRoute']);

  app.controller('AppCtrl', function ($scope) {
  });

  app.controller('DetailsCtrl', function ($scope, dataFactory, $routeParams, $location, $mdDialog, notifyService) {
    $scope.parties = dataFactory.getParties();
    $scope.isNew = true;
    $scope.date = new Date();
    $scope.formLabel = "New Expense";

    $scope.goBack = function () {
      if (!$scope.expenseForm.$dirty) {
        $location.path("/");
        return;
      }
      var confirm = $mdDialog.confirm()
        .textContent('Discard changes?')
        .ok('Discard')
        .cancel('Cancel');

      $mdDialog.show(confirm).then(function () {
        notifyService.showToast("Changes discarded");
        $location.path("/");
      });
    }

    $scope.save = function () {
      dataFactory.saveExpense({
        id: $scope.expenseId,
        date: $scope.date,
        party: $scope.party,
        amount: $scope.amount,
        description: $scope.description
      }, function (resp) {
        if (!resp.error) {
          notifyService.showToast("Record saved");
          $location.path("/");
        } else {
          notifyService.showToast(resp.error);
        }
      });
    }

    $scope.confirmDelete = function () {
      var confirm = $mdDialog.confirm()
        .textContent('Delete this record?')
        .ok('Delete')
        .cancel('Cancel');

      $mdDialog.show(confirm).then(function () {
        dataFactory.deleteExpenseById($scope.expenseId, function (resp) {
          if (!resp.error) {
            notifyService.showToast("Expense deleted");
            $location.path("/");
          } else {
            notifyService.showToast(resp.error);
          }
        });
      });
    };

    $scope.promptNewParty = function () {
      var dialog = $mdDialog.prompt()
        .title('Add a new party?')
        .placeholder('New party')
        .ariaLabel('New party')
        .ok('Add')
        .cancel('Cancel');

      $mdDialog.show(dialog).then(function (result) {
        dataFactory.addParty(result);
        $scope.party = result;
      });
    };

    var expenseId = parseInt($routeParams.expenseId);
    if ($routeParams.expenseId !== undefined && isNaN(expenseId)) {
      $location.path("/");
      return;
    }
    if (expenseId > 0) {
      var expense = dataFactory.getExpenseById(expenseId);
      if (expense === undefined) {
        $location.path("/");
        return;
      }
      $scope.isNew = false;
      $scope.formLabel = "Edit Expense";
      $scope.date = expense.date;
      $scope.party = expense.party;
      $scope.amount = expense.amount;
      $scope.description = expense.description;
      $scope.expenseId = expense.id;
    }
  });

  app.controller('ListCtrl', function ($scope, $location, dataFactory, $timeout) {
    $scope.createNew = function () {
      $location.path("/details");
    }

    $scope.edit = function (id) {
      $location.path("/details/" + id);
    }

    $scope.dataLoaded = false;

    dataFactory.getList(function (resp) {
      $scope.dataLoaded = resp.dataLoaded;
      $scope.expenses = resp.expenses;
      $scope.loadMessage = null;
      if (resp.expenses.length == 0) { $scope.loadMessage = "No entires in the database."; }
      if (resp.error) { $scope.loadMessage = resp.error; }
    });
  });

  app.service("notifyService", function ($mdToast) {
    this.showToast = function (msg) {
      $mdToast.show(
        $mdToast.simple()
          .textContent(msg)
          .hideDelay(2000)
      );
    }
  });

  app.factory("dataFactory", function ($filter, $http) {
    var parties = [];
    var expenses = [];
    var maxId = 0;
    var dataLoaded = false;

    function getList(callback) {
      if (!dataLoaded) {
        $http.get('dal.php?get').then(
          function (response) {
            dataLoaded = true;
            expenses = response.data;
            expenses.forEach(function (exp) {
              //convert date from string to actual Dateo bject
              exp.date = new Date(exp.date);
              if (maxId < exp.id) { maxId = exp.id; }
              //add parties to the list
              if (exp.party && exp.party.length > 0 && parties.indexOf(exp.party) === -1) { parties.push(exp.party); }
            });
            callback({ dataLoaded: dataLoaded, expenses: expenses, error: false });
          },
          function (response) {
            callback({ dataLoaded: true, expenses: [], error: response.data.error_text });
          });
      } else {
        callback({ dataLoaded: dataLoaded, expenses: expenses, error: false });
      }
    };

    function saveExpense(expense, callback) {
      $http.post('dal.php?upsert', expense).then(
        function (response) {
          //if response is ok, update local dataset
          if (!expense.id) {
            expense.id = response.data.data;
            expenses.push(expense);
          } else {
            for (var i = 0; i < expenses.length; i++) {
              if (expenses[i].id != expense.id) { continue; }
              expenses[i] = expense;
              break;
            }
          }
          callback({ error: false });
        },
        function (response) {
          callback({ error: "Error " + response.data.return_code + ": " + response.data.error_text });
        });
    };

    function deleteExpenseById(id, callback) {
      $http.post('dal.php?delete', { id: id }).then(
        //if response is ok, update local dataset
        function (response) {
          for (var i = 0; i < expenses.length; i++) {
            if (expenses[i].id != id) { continue; }
            expenses.splice(i, 1);
            break;
          }
          callback({ error: false });
        },
        function (response) {
          callback({ error: "Error " + response.data.return_code + ": " + response.data.error_text });
        });
    };

    function getParties() {
      return parties;
    };

    function addParty(newParty) {
      if (parties.indexOf(newParty) === -1) { parties.push(newParty); }
    }

    function getExpenseById(id) {
      return $filter('filter')(expenses, { id: id }, true)[0];
    }

    function isDataLoded() {
      return dataLoaded;
    }

    return {
      getExpenseById: getExpenseById,
      getParties: getParties,
      addParty: addParty,
      getList: getList,
      saveExpense: saveExpense,
      deleteExpenseById: deleteExpenseById,
      isDataLoded: isDataLoded,
    };
  });

  app.config(function ($mdDateLocaleProvider, $mdThemingProvider) {

    $mdThemingProvider.theme('default')
      .primaryPalette('red')
      .accentPalette('amber');

    $mdDateLocaleProvider.firstDayOfWeek = 1;
    moment.locale('hr');

    $mdDateLocaleProvider.parseDate = function (dateString) {
      var m = moment(dateString, 'L', true);
      return m.isValid() ? m.toDate() : new Date(NaN);
    };

    $mdDateLocaleProvider.formatDate = function (date) {
      var m = moment(date);
      return m.isValid() ? m.format('L') : '';
    };

  });

  app.config(function ($routeProvider) {
    $routeProvider
      .when("/", {
        templateUrl: 'list.html',
        controller: 'ListCtrl',
      })
      .when("/details/:expenseId?", {
        templateUrl: 'details.html',
        controller: 'DetailsCtrl',
      });
  });

})();

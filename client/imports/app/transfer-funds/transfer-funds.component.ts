import { Component, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Meteor } from 'meteor/meteor';
import { AccountsService } from '../core/services/accounts.service';

import template from './transfer-funds.component.html';

declare var EthAccounts;
declare var EthTools;
declare var web3;

@Component({
  selector: 'transfer-funds',
  template
})
export class TransferFundsComponent implements OnInit {
  private autorunComputation: Tracker.Computation;
  private currentUser: Account;
  private currentEthAccount: any;
  private formData: any = {};
  private message: string;
  private errors: Array<string>;
  private isTransferring: boolean = false;
  private isBalanceUpdated: boolean = false;

  constructor(private accountsService: AccountsService,
              private router: Router,
              private zone: NgZone) {
    this._initAutorun();
  }

  ngOnInit() {
    this.resetData();
    this.resetErrors();
  }

  _initAutorun(): void {
    let self = this;
    this.autorunComputation = Tracker.autorun(() => {
      this.zone.run(() => {
        if (self.accountsService.isLoggedIn()) {
          self.currentUser = self.accountsService.getCurrentUserAccount();
          if (self.currentUser) {
            self.currentEthAccount = EthAccounts.findOne({address: self.currentUser.eth_address});
            if (self.currentEthAccount) {
              self.currentEthAccount.balance_unit = self.accountsService.formatBalance(self.currentEthAccount.balance);
              self.isBalanceUpdated = false;
              setTimeout(() => {
                self.isBalanceUpdated = true;
              }, 100);
            }
          }
        }
        else if (!self.accountsService.isLoggingIn()) {
          self.router.navigate(['/login']);
        }
      });
    });
  }

  getUnit(): string {
    return EthTools.getUnit();
  }

  resetData() {
    this.formData.target_email = '';
    this.formData.eth_password = '';
    this.formData.amount = 0;
    this.formData.button_text = 'Transfer';
  }

  resetErrors() {
    this.message = '';
    this.errors = [];
  }

  transfer(e) {
    this.isTransferring = true;
    // this.formData.button_text = "Transferring...";
    e.preventDefault();
    this.resetErrors();
    let targetAccount = Meteor.users.findOne({'emails.address': this.formData.target_email});
    if (!targetAccount) {
      this.errors.push('Target account not found');
    }
    let amount = this.formData.amount;
    let amountInWei = null;
    if (_.isEmpty(amount) || amount === '0' || !_.isFinite(amount) || amount < 0) {
      this.errors.push('Amount should be greater than 0');
    }
    else {
      amountInWei = EthTools.toWei(amount);
      if (new BigNumber(amountInWei, 10).gt(new BigNumber(this.currentEthAccount.balance, 10))) {
        this.errors.push('Not enough balance');
      }
    }

    if (this.errors.length <= 0) {
      let targetAddress = targetAccount.profile.eth_address;
      let sourceAddress = this.currentEthAccount.address;
      //unlock source account
      web3.personal.unlockAccount(sourceAddress, this.formData.eth_password, (err, result) => {
        if (err) {
          console.log(err);
          this.errors.push('Invalid ethereum password');
          this.isTransferring = false;
        }
        else {
          web3.eth.sendTransaction({
            from: sourceAddress,
            to: targetAddress,
            value: amountInWei
          }, (err, address) => {
            if (err) {
              console.log(err);
              this.errors.push('Internal error occurred. Please try again');
              this.isTransferring = false;
            }
            else {
              console.log('Transaction Address: ', address);
              this.message = 'Transfer complete!';
              this.resetData();
              this.isTransferring = false;
            }
          });
        }
      });
    }
    else {
      this.isTransferring = false;
    }
  }
}
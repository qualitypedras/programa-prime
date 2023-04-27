import { Component } from '@angular/core';
import { Validators, FormBuilder, FormArray, FormGroup } from '@angular/forms';
import { AuthService } from 'src/app/shared/service/auth.service';
import { OrcamentoService } from '../orcamento.service';
import { HttpClient } from '@angular/common/http';
import { v4 as uuidv4 } from 'uuid';
import { ActivatedRoute, Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import * as moment from 'moment';
import { ConfirmationService, MessageService } from 'primeng/api';

@Component({
    templateUrl: './criar.component.html',
    providers: [AuthService, OrcamentoService],
})
export class CriarOrcamentoComponent {
    form = this.fb.group({
        nomeCliente: ['', [Validators.required]],
        telCliente: ['', [Validators.required]],
        cepCliente: [''],
        enderecoCliente: [''],
        numeroEnderecoCliente: [''],
        cidadeCliente: [''],
        estadoCliente: [''],
        complementoCliente: [''],
        dataEnvio: [moment(new Date()).toDate(), [Validators.required]],
        dataCriacao: [new Date().toLocaleString(), [Validators.required]],
        atendente: ['', [Validators.required]],
        informacaoAdicional: [''],
        observacao: [''],
        ambientes: this.fb.array([]),
    });

    orcamento: any;
    orcamentoId: string | undefined;
    loading = false;

    maxDate = new Date();

    constructor(
        private fb: FormBuilder,
        public auth: AuthService,
        private orcamentoService: OrcamentoService,
        private route: ActivatedRoute,
        private http: HttpClient,
        public afs: AngularFirestore,
        private confirmationService: ConfirmationService,
        private messageService: MessageService,
        public router: Router
    ) {
        this.form.get('atendente')?.setValue(auth.user.displayName);
    }

    ngOnInit() {
        this.route.queryParams.subscribe(async (params) => {
            const id = params['id'];
            this.orcamentoId = id;
            if (id) {
                this.afs
                    .collection('orcamentos')
                    .doc(id)
                    .ref.get()
                    .then((doc) => {
                        if (doc.exists) {
                            this.orcamento = doc.data();
                            if (this.orcamento.dataEnvio?.seconds)
                                this.orcamento.dataEnvio = moment(
                                    this.orcamento.dataEnvio.seconds * 1000
                                ).toDate();
                            this.form.patchValue(this.orcamento, {
                                emitEvent: false,
                            });
                            if (this.orcamento?.ambientes) {
                                const ambiente = this.form.get(
                                    'ambientes'
                                ) as FormArray;
                                for (
                                    let i = 0;
                                    i < this.orcamento?.ambientes.length;
                                    i++
                                ) {
                                    ambiente.push(
                                        this.fb.group({
                                            descricao: [
                                                this.orcamento?.ambientes[i]
                                                    .descricao,
                                            ],
                                            itens: this.fb.array([]),
                                        })
                                    );

                                    for (
                                        let j = 0;
                                        j <
                                        this.orcamento?.ambientes[i]['itens']
                                            .length;
                                        j++
                                    ) {
                                        const item =
                                            this.orcamento?.ambientes[i][
                                                'itens'
                                            ][j];
                                        const ambienteToPush = this.form.get(
                                            'ambientes'
                                        ) as FormArray;
                                        const itensToPush = ambienteToPush
                                            .at(i)
                                            .get('itens') as FormArray;
                                        itensToPush.push(
                                            this.fb.group({
                                                quantidade: [item.quantidade],
                                                especificacao: [
                                                    item.especificacao,
                                                ],
                                                material: [item.material],
                                                medida: [item.medida],
                                                valor: [item.valor],
                                            })
                                        );
                                    }
                                }
                            }
                        }
                    })
                    .catch((error) => console.error(error));
            }
        });
        this.form.get('cepCliente')?.valueChanges.subscribe({
            next: (value) => {
                const cep = value?.replace(/[^\d]/g, '');
                if (cep && cep.length == 8) {
                    this.http
                        .get(`https://viacep.com.br/ws/${cep}/json/`)
                        .subscribe((data: any) => {
                            this.form.patchValue({
                                enderecoCliente: data.logradouro,
                                numeroEnderecoCliente: data.numero,
                                cidadeCliente: data.localidade,
                                estadoCliente: data.uf,
                            });
                        });
                }
            },
        });
    }

    toTitleCase(event) {
        const filterValue = (event.target as HTMLInputElement).value;
        const newString = filterValue.replace(/\w\S*/g, function (txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
        this.form.get('nomeCliente')?.setValue(newString);
    }

    phoneMaskBrazil(event) {
        var key = event.key;
        var element = event.target;
        var isAllowed = /\d|Backspace|Tab/;
        if (!isAllowed.test(key)) event.preventDefault();

        var inputValue = element.value;
        inputValue = inputValue.replace(/\D/g, '');
        inputValue = inputValue.replace(/(^\d{2})(\d)/, '($1) $2');
        inputValue = inputValue.replace(/(\d{4,5})(\d{4}$)/, '$1-$2');

        element.value = inputValue;
    }

    zipCodeMask(event) {
        let value = event.target.value;

        if (!value) return;
        value = value.replace(/\D/g, '');
        value = value.replace(/(\d{5})(\d)/, '$1-$2');
        event.target.value = value;
    }

    removerAmbiente(index) {
        const ambiente = this.form.get('ambientes') as FormArray;
        this.confirmationService.confirm({
            message: `Tem certeza que deseja excluir o ambiente <strong>${ambiente
                .at(index)
                .value.descricao?.toUpperCase()}</strong>? `,
            header: 'Confirmação',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                ambiente.removeAt(index);
                this.messageService.add({
                    severity: 'info',
                    summary: 'Sucesso!',
                    detail: 'Ambiente excluído.',
                });
            },
        });
    }

    removerItem(ambienteIndex, index) {
        const ambiente = this.form.get('ambientes') as FormArray;
        const itens = ambiente.at(ambienteIndex).get('itens') as FormArray;
        this.confirmationService.confirm({
            message: `Você tem certeza que deseja excluir o item <strong>${itens
                .at(index)
                .get('especificacao')
                ?.value.toUpperCase()}</strong>? `,
            header: 'Confirmação',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                itens.removeAt(index);
                this.messageService.add({
                    severity: 'info',
                    summary: 'Sucesso!',
                    detail: 'Item excluído.',
                });
            },
        });
    }

    duplicarItem(ambienteIndex, index) {
        const ambiente = this.form.get('ambientes') as FormArray;
        const itens = ambiente.at(ambienteIndex).get('itens') as FormArray;
        const item = itens.at(index) as any;
        itens.push(
            this.fb.group({
                quantidade: [item.controls['quantidade'].value],
                especificacao: [item.controls['especificacao'].value],
                material: [item.controls['material'].value],
                medida: [item.controls['medida'].value],
                valor: [item.controls['valor'].value],
            })
        );
    }

    adicionarAmbiente() {
        const ambiente = this.form.get('ambientes') as FormArray;
        ambiente.push(
            this.fb.group({
                descricao: [''],
                itens: this.fb.array([]),
            })
        );
    }

    getItensAmbiente(ambienteIndex: number) {
        const ambiente = this.form.get('ambientes') as FormArray;
        const item = ambiente.at(ambienteIndex).get('itens') as FormArray;
        return item.controls;
    }

    adicionarItem(ambienteIndex: number) {
        const ambiente = this.form.get('ambientes') as FormArray;
        const itens = ambiente.at(ambienteIndex).get('itens') as FormArray;
        itens.push(
            this.fb.group({
                quantidade: [1],
                especificacao: [''],
                material: [''],
                medida: [''],
                valor: [''],
            })
        );
    }

    async enviar() {
        this.loading = true;

        await this.confirmationService.confirm({
            message: `O atendente salvo será <strong>${
                this.form.get('atendente')?.value
            }</strong>. Deseja continuar?`,
            header: 'Confirmação',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                let form = this.form.value as any;
                form.valorTotal = this.getValorTotalItens();
                form.status = 'CRIADO';
                if (!this.orcamentoId) form.uid = uuidv4();
                if (this.orcamentoId) form.uid = this.orcamentoId;
                this.orcamentoService.SaveOrcamento(form);
                this.messageService.add({
                    severity: 'info',
                    summary: 'Sucesso!',
                    detail: 'Orçamento salvo. Redirecionando...',
                });
                setTimeout(() => {
                    this.router.navigate(['/orcamentos/pesquisar']);
                }, 1500);
            },
        });

        this.loading = false;
    }

    getAmbientes() {
        const ambientes = this.form.get('ambientes') as FormArray;
        return ambientes.controls;
    }

    log(value) {
        console.log(value);
    }

    getValorTotalItens() {
        let valorTotal = 0;
        const ambiente = this.form.get('ambientes') as FormArray;
        ambiente.controls.forEach((ctrl: any) => {
            if (ctrl) {
                const ctrl2 = ctrl.controls['itens'].controls;
                ctrl2.forEach((ctrl3) => {
                    valorTotal += Number(
                        ctrl3.controls['valor'].value
                            .replace('R$', '')
                            .replace('.', '')
                            .replace(',', '.')
                    );
                });
            }
        });
        return valorTotal;
    }
}
